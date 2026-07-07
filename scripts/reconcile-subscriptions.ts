// Manual Stripe ↔ local Subscription reconciliation (ADR-0019 Track A).
//
// The webhook (/api/billing/webhook) is the normal sync path; this script is
// the manual safety net for drift (missed deliveries, manual dashboard edits).
// It READS Stripe and REPORTS drift — it does NOT mutate anything (a repair
// mode + scheduled alerting is ADR-0023 scope).
//
// Usage (host, DATABASE_URL + STRIPE_SECRET_KEY exported from .env.local):
//   npx tsx scripts/reconcile-subscriptions.ts
//
// Usage (self-hosted Docker deployment, per ADR-0022):
//   docker compose exec app npx tsx scripts/reconcile-subscriptions.ts
//
// Exit codes: always 0 (report-only), including the honest
// "stripe not configured" case — drift is reported in the output summary.

import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const prisma = new PrismaClient()

type LocalStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE'

function mapStripeStatus(status: Stripe.Subscription.Status): LocalStatus {
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
      return 'CANCELED'
  }
}

function tierForPriceId(priceId: string | null): 'PRO' | 'BUSINESS' | null {
  if (!priceId) return null
  const pro = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim()
  const business = process.env.STRIPE_PRICE_BUSINESS_MONTHLY?.trim()
  if (pro && priceId === pro) return 'PRO'
  if (business && priceId === business) return 'BUSINESS'
  return null
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    // Honest: nothing to reconcile against without Stripe access.
    console.log('stripe not configured (STRIPE_SECRET_KEY unset) — nothing to reconcile.')
    process.exit(0)
  }
  const stripe = new Stripe(key)

  const rows = await prisma.subscription.findMany({
    where: { stripeSubscriptionId: { not: null } },
    include: { workspace: { select: { name: true } } },
  })
  console.log(`Reconciling ${rows.length} subscription(s) with a stripeSubscriptionId...`)

  let checked = 0
  let drifted = 0
  let errors = 0

  for (const row of rows) {
    const label = `${row.workspaceId} (${row.workspace.name})`
    try {
      const stripeSub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId!)
      checked++

      const driftNotes: string[] = []

      const expectedStatus = mapStripeStatus(stripeSub.status)
      if (row.status !== expectedStatus) {
        driftNotes.push(
          `status local=${row.status} stripe=${stripeSub.status} (→ ${expectedStatus})`
        )
      }

      const stripePriceId = stripeSub.items?.data?.[0]?.price?.id ?? null
      const expectedTier = tierForPriceId(stripePriceId)
      if (stripePriceId && row.stripePriceId !== stripePriceId) {
        driftNotes.push(`priceId local=${row.stripePriceId ?? 'null'} stripe=${stripePriceId}`)
      }
      if (expectedTier && row.planTier !== expectedTier) {
        driftNotes.push(`tier local=${row.planTier} stripe=${expectedTier}`)
      } else if (stripePriceId && !expectedTier) {
        driftNotes.push(
          `stripe price ${stripePriceId} maps to no known tier (check STRIPE_PRICE_* env)`
        )
      }

      if (row.cancelAtPeriodEnd !== stripeSub.cancel_at_period_end) {
        driftNotes.push(
          `cancelAtPeriodEnd local=${row.cancelAtPeriodEnd} stripe=${stripeSub.cancel_at_period_end}`
        )
      }

      if (driftNotes.length > 0) {
        drifted++
        console.log(`DRIFT ${label} [${row.stripeSubscriptionId}]:`)
        for (const note of driftNotes) console.log(`  - ${note}`)
      } else {
        console.log(`OK    ${label}`)
      }
    } catch (err) {
      errors++
      console.error(
        `ERROR ${label} [${row.stripeSubscriptionId}]: ${err instanceof Error ? err.message : err}`
      )
    }
  }

  console.log(
    `\nSummary: ${checked} checked, ${drifted} drifted, ${errors} error(s), ` +
      `${rows.length - checked - errors} skipped. Report-only — no rows were mutated.`
  )
  process.exit(0)
}

main()
  .catch((e) => {
    console.error('Reconciliation failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
