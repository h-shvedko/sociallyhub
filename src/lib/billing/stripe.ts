// Lazy Stripe client (ADR-0019 Track A).
//
// NEVER construct env-dependent clients at module scope (ADR-0022 build
// lesson: module-scope constructors that read env kill hermetic builds —
// `next build` imports every route module with no runtime env present).
// Everything here resolves env at CALL time and fails closed with honest
// errors — there is no mock fallback (ADR-0019 honesty rule).

import Stripe from 'stripe'

let stripeSingleton: Stripe | null = null

/** True when a Stripe secret key is present in the environment. */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

/**
 * Lazy singleton Stripe client. Throws honestly when the key is unset —
 * routes must check isStripeConfigured() first and return
 * 503 { error: 'stripe_not_configured' } instead of ever faking success.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set — billing is unavailable')
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key)
  }
  return stripeSingleton
}

/** Webhook signing secret; throws honestly when unset. */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not set — webhook signature verification is unavailable'
    )
  }
  return secret
}

let webhookVerifierSingleton: Stripe | null = null

/**
 * Stripe instance for webhook SIGNATURE VERIFICATION only.
 *
 * `webhooks.constructEvent` is pure HMAC math over the raw body + the
 * webhook secret — the API key is never used. Gating verification on
 * STRIPE_SECRET_KEY would therefore be wrong (and breaks offline tests),
 * so when the real client is unavailable this returns a client built with
 * a placeholder key that can NEVER make a successful API call. Callers
 * must still gate on getWebhookSecret() for the honest 503.
 */
export function getWebhookVerifier(): Stripe {
  if (isStripeConfigured()) return getStripe()
  if (!webhookVerifierSingleton) {
    webhookVerifierSingleton = new Stripe('sk_webhook_signature_verification_only')
  }
  return webhookVerifierSingleton
}
