// Billing plan catalog (ADR-0019 Track A).
//
// Single source of truth for plan tiers, their limits, and the mapping
// between local tiers and Stripe price ids. Display prices live here for
// the UI only — the REAL prices are whatever the Stripe Price objects say
// (env: STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_BUSINESS_MONTHLY).
//
// HONESTY RULE: nothing in this module talks to Stripe or fabricates
// billing state; it is pure configuration + env lookups.

export type PlanTierKey = 'FREE' | 'PRO' | 'BUSINESS'

export type LimitKey =
  | 'socialAccounts'
  | 'postsPerMonth'
  | 'teamSeats'
  | 'aiCreditsPerMonth'

/** Per-tier limits. `null` = unlimited. */
export const PLAN_LIMITS: Record<PlanTierKey, Record<LimitKey, number | null>> = {
  FREE: {
    socialAccounts: 3,
    postsPerMonth: 10,
    teamSeats: 1,
    aiCreditsPerMonth: 20,
  },
  PRO: {
    socialAccounts: 15,
    postsPerMonth: 100,
    teamSeats: 5,
    aiCreditsPerMonth: 500,
  },
  BUSINESS: {
    socialAccounts: 50,
    postsPerMonth: null,
    teamSeats: 25,
    aiCreditsPerMonth: 2000,
  },
}

/**
 * Boolean plan features (ADR-0020). Unlike LimitKey counters these are
 * on/off per tier. `clientPortal` gates GRANTING portal access (creating
 * CLIENT_VIEWER invitations) — existing portal members keep read access on
 * downgrade, because the external client cannot fix the agency's billing.
 * Report share links are deliberately NOT gated: they are the delivery
 * mechanism for reports every tier can already generate and email.
 */
export type FeatureKey = 'clientPortal'

export const PLAN_FEATURES: Record<PlanTierKey, Record<FeatureKey, boolean>> = {
  FREE: { clientPortal: false },
  PRO: { clientPortal: true },
  BUSINESS: { clientPortal: true },
}

/** Display-only monthly prices in USD; real prices live in Stripe. */
export const PLAN_PRICES_USD = { FREE: 0, PRO: 29, BUSINESS: 79 }

/**
 * Stripe price id for a paid tier, read from env at call time (never at
 * module scope — build lesson from ADR-0022). Returns null when the env
 * var is unset/empty so callers can fail honestly.
 */
export function priceIdForTier(tier: 'PRO' | 'BUSINESS'): string | null {
  const id =
    tier === 'PRO'
      ? process.env.STRIPE_PRICE_PRO_MONTHLY
      : process.env.STRIPE_PRICE_BUSINESS_MONTHLY
  return id && id.trim() !== '' ? id.trim() : null
}

/**
 * Reverse mapping: which local tier does a Stripe price id represent?
 * Returns null for unknown price ids (e.g. a price created in the Stripe
 * dashboard but not wired into env) — callers must handle that honestly
 * instead of guessing a tier.
 */
export function tierForPriceId(priceId: string): PlanTierKey | null {
  if (!priceId) return null
  const pro = process.env.STRIPE_PRICE_PRO_MONTHLY
  const business = process.env.STRIPE_PRICE_BUSINESS_MONTHLY
  if (pro && priceId === pro.trim()) return 'PRO'
  if (business && priceId === business.trim()) return 'BUSINESS'
  return null
}
