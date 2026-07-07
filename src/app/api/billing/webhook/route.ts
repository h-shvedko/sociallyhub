// POST /api/billing/webhook (ADR-0019 Track A) — THE CRITICAL ROUTE.
//
// Stripe is the source of truth for billing state; this webhook is the ONLY
// writer that syncs it into the local Subscription cache. Documented
// exception to the session-auth rule (docs/api-conventions.md): the request
// is authenticated by the Stripe signature over the RAW body instead.
//
// Idempotency: the StripeEvent ledger row is created inside the SAME
// prisma.$transaction as the state mutation, so an event is applied
// exactly once — a replay hits the StripeEvent PK (P2002) and returns
// 200 { received: true, duplicate: true } without re-applying anything.
//
// Stripe API note (stripe-node v22, API 2026-06-24.dahlia):
// current_period_start/end moved from Subscription to SubscriptionItem, and
// an Invoice's subscription id lives at parent.subscription_details.

import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { Prisma, PlanTier, SubscriptionStatus } from '@prisma/client'

import { jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { tierForPriceId } from '@/lib/billing/plans'
import {
  getStripe,
  getWebhookSecret,
  getWebhookVerifier,
  isStripeConfigured,
} from '@/lib/billing/stripe'

export const dynamic = 'force-dynamic'

type Tx = Prisma.TransactionClient

// --- Stripe → local status mapping -----------------------------------------

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE'
    case 'trialing':
      return 'TRIALING'
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE'
    case 'canceled':
      return 'CANCELED'
    case 'incomplete':
    case 'incomplete_expired':
      return 'INCOMPLETE'
    default:
      // Unknown/new Stripe status (e.g. paused): fail closed to CANCELED
      // (effective tier FREE) rather than inventing entitlements.
      console.warn(`[billing:webhook] Unmapped Stripe status '${status}' → CANCELED`)
      return 'CANCELED'
  }
}

function epochToDate(epoch: number | null | undefined): Date | null {
  return typeof epoch === 'number' ? new Date(epoch * 1000) : null
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

/**
 * Extract the fields we cache locally from a Stripe subscription.
 * Periods live on the first subscription item (API dahlia).
 */
function extractSubscriptionState(sub: Stripe.Subscription): {
  stripeCustomerId: string | null
  stripePriceId: string | null
  planTier: PlanTier | null
  status: SubscriptionStatus
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: Date | null
} {
  const item = sub.items?.data?.[0]
  const priceId = item?.price?.id ?? null
  const tier = priceId ? tierForPriceId(priceId) : null
  if (priceId && !tier) {
    console.warn(
      `[billing:webhook] Stripe price ${priceId} on subscription ${sub.id} maps to no known tier ` +
        `(check STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_BUSINESS_MONTHLY) — keeping the stored tier.`
    )
  }
  return {
    stripeCustomerId: idOf(sub.customer),
    stripePriceId: priceId,
    planTier: tier,
    status: mapStripeStatus(sub.status),
    currentPeriodStart: epochToDate(item?.current_period_start),
    currentPeriodEnd: epochToDate(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEndsAt: epochToDate(sub.trial_end),
  }
}

/**
 * Apply extracted Stripe subscription state onto the local row, located by
 * stripeSubscriptionId, falling back to stripeCustomerId (first event for a
 * subscription created via Checkout arrives before we stored its id).
 * Returns false when no local row could be attributed.
 */
async function applySubscriptionState(
  tx: Tx,
  stripeSubscriptionId: string,
  state: ReturnType<typeof extractSubscriptionState>
): Promise<boolean> {
  let row = await tx.subscription.findUnique({ where: { stripeSubscriptionId } })
  if (!row && state.stripeCustomerId) {
    row = await tx.subscription.findUnique({
      where: { stripeCustomerId: state.stripeCustomerId },
    })
  }
  if (!row) {
    console.warn(
      `[billing:webhook] No local Subscription row for Stripe subscription ${stripeSubscriptionId} ` +
        `(customer ${state.stripeCustomerId ?? 'unknown'}) — event recorded, state not applied.`
    )
    return false
  }
  await tx.subscription.update({
    where: { id: row.id },
    data: {
      stripeSubscriptionId,
      ...(state.stripeCustomerId ? { stripeCustomerId: state.stripeCustomerId } : {}),
      ...(state.stripePriceId ? { stripePriceId: state.stripePriceId } : {}),
      // Only move the tier when the price id maps to a known tier — never guess.
      ...(state.planTier ? { planTier: state.planTier } : {}),
      status: state.status,
      currentPeriodStart: state.currentPeriodStart,
      currentPeriodEnd: state.currentPeriodEnd,
      cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      trialEndsAt: state.trialEndsAt,
    },
  })
  return true
}

/** Stripe subscription id referenced by an invoice (API dahlia location). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription ?? null)
}

/** Set only the status on the row attributed to an invoice's subscription/customer. */
async function applyInvoiceStatus(
  tx: Tx,
  invoice: Stripe.Invoice,
  status: SubscriptionStatus
): Promise<void> {
  const subId = invoiceSubscriptionId(invoice)
  const customerId = idOf(invoice.customer)
  if (!subId && !customerId) {
    console.warn('[billing:webhook] Invoice event without subscription/customer reference — skipped.')
    return
  }
  let row = subId
    ? await tx.subscription.findUnique({ where: { stripeSubscriptionId: subId } })
    : null
  if (!row && customerId) {
    row = await tx.subscription.findUnique({ where: { stripeCustomerId: customerId } })
  }
  if (!row) {
    console.warn(
      `[billing:webhook] No local Subscription row for invoice ${invoice.id} ` +
        `(subscription ${subId ?? 'n/a'}, customer ${customerId ?? 'n/a'}) — event recorded, state not applied.`
    )
    return
  }
  await tx.subscription.update({ where: { id: row.id }, data: { status } })
}

// --- Route ------------------------------------------------------------------

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  )
}

export async function POST(request: NextRequest) {
  // Signature verification requires the RAW body — read it before any parsing.
  const rawBody = await request.text()

  // Verification needs ONLY the webhook secret (pure HMAC — no API key):
  // without it we can authenticate nothing, so we accept nothing.
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return jsonError(503, 'stripe_not_configured')
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return jsonError(400, 'Missing stripe-signature header', { code: 'INVALID_SIGNATURE' })
  }

  let event: Stripe.Event
  try {
    event = getWebhookVerifier().webhooks.constructEvent(
      rawBody,
      signature,
      getWebhookSecret()
    )
  } catch (err) {
    console.warn('[billing:webhook] Signature verification failed:', err)
    return jsonError(400, 'Invalid signature', { code: 'INVALID_SIGNATURE' })
  }

  try {
    // Phase 1 — anything that needs the Stripe API happens BEFORE the DB
    // transaction (network calls inside a transaction would hold locks).
    let mutate: (tx: Tx) => Promise<void>

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const workspaceId = session.client_reference_id
        const customerId = idOf(session.customer)
        const subscriptionId = idOf(session.subscription)

        if (!workspaceId) {
          console.warn(
            `[billing:webhook] checkout.session.completed ${session.id} has no client_reference_id — recorded only.`
          )
          mutate = async () => {}
          break
        }

        // Fetch the real subscription so tier/status/periods are truthful.
        // Requires the API key; without it we still attach the customer/
        // subscription ids and let customer.subscription.* events (which
        // carry full state in their payload) do the sync.
        let stripeSub: Stripe.Subscription | null = null
        if (subscriptionId && isStripeConfigured()) {
          stripeSub = await getStripe().subscriptions.retrieve(subscriptionId)
        } else if (subscriptionId) {
          console.warn(
            '[billing:webhook] STRIPE_SECRET_KEY unset — cannot retrieve subscription ' +
              `${subscriptionId} for checkout.session.completed; ids attached, tier sync deferred.`
          )
        }
        const state = stripeSub ? extractSubscriptionState(stripeSub) : null

        mutate = async (tx) => {
          await tx.subscription.upsert({
            where: { workspaceId },
            update: {
              ...(customerId ? { stripeCustomerId: customerId } : {}),
              ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
              ...(state
                ? {
                    ...(state.stripePriceId ? { stripePriceId: state.stripePriceId } : {}),
                    ...(state.planTier ? { planTier: state.planTier } : {}),
                    status: state.status,
                    currentPeriodStart: state.currentPeriodStart,
                    currentPeriodEnd: state.currentPeriodEnd,
                    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
                    trialEndsAt: state.trialEndsAt,
                  }
                : {}),
            },
            create: {
              workspaceId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: state?.stripePriceId ?? null,
              planTier: state?.planTier ?? 'FREE',
              status: state?.status ?? 'ACTIVE',
              currentPeriodStart: state?.currentPeriodStart ?? null,
              currentPeriodEnd: state?.currentPeriodEnd ?? null,
              cancelAtPeriodEnd: state?.cancelAtPeriodEnd ?? false,
              trialEndsAt: state?.trialEndsAt ?? null,
            },
          })
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const state = extractSubscriptionState(sub)
        mutate = async (tx) => {
          await applySubscriptionState(tx, sub.id, state)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = idOf(sub.customer)
        mutate = async (tx) => {
          let row = await tx.subscription.findUnique({
            where: { stripeSubscriptionId: sub.id },
          })
          if (!row && customerId) {
            row = await tx.subscription.findUnique({
              where: { stripeCustomerId: customerId },
            })
          }
          if (!row) {
            console.warn(
              `[billing:webhook] subscription.deleted for unknown ${sub.id} — recorded only.`
            )
            return
          }
          await tx.subscription.update({
            where: { id: row.id },
            data: { status: 'CANCELED', cancelAtPeriodEnd: false },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        mutate = async (tx) => applyInvoiceStatus(tx, invoice, 'PAST_DUE')
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        mutate = async (tx) => applyInvoiceStatus(tx, invoice, 'ACTIVE')
        break
      }

      default:
        // Unknown/unhandled type: record it in the ledger and acknowledge.
        mutate = async () => {}
        break
    }

    // Phase 2 — ledger + mutation in ONE transaction. The StripeEvent PK is
    // the idempotency key: a concurrent/replayed delivery violates it and the
    // whole transaction (including the mutation) rolls back.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.stripeEvent.create({
          data: {
            id: event.id,
            type: event.type,
            apiVersion: event.api_version ?? null,
          },
        })
        await mutate(tx)
      })
    } catch (err) {
      if (isUniqueViolation(err)) {
        return NextResponse.json({ received: true, duplicate: true })
      }
      throw err
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    // 500 → Stripe retries the delivery, which is exactly what we want for
    // transient DB/Stripe-API failures. Never leak internals.
    console.error('[billing:webhook] Handler error:', error)
    return jsonError(500, 'Webhook handler failed', { code: 'INTERNAL_ERROR' })
  }
}
