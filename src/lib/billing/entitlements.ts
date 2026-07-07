// Entitlements + usage resolution (ADR-0019 Track A).
//
// The Subscription row is a CACHE of Stripe state kept fresh by the
// webhook (/api/billing/webhook); this module turns that cache into an
// effective tier + limits and counts REAL usage from the database — no
// fabricated numbers, no mock fallbacks.

import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  type FeatureKey,
  type LimitKey,
  type PlanTierKey,
} from './plans'
import { isStripeConfigured } from './stripe'

/**
 * PURE tier resolution (unit-testable, no DB):
 * - no subscription row → FREE
 * - CANCELED / INCOMPLETE → FREE
 * - TRIALING → the subscription's tier while trialEndsAt > now, else FREE
 * - ACTIVE and PAST_DUE → the subscription's tier (PAST_DUE keeps access;
 *   Stripe dunning / customer.subscription.deleted downgrades it for real)
 * - any unknown status → FREE (fail closed, never invent entitlements)
 */
export function resolveEffectiveTier(
  sub: { planTier: PlanTierKey; status: string; trialEndsAt: Date | null } | null,
  now: Date = new Date()
): PlanTierKey {
  if (!sub) return 'FREE'
  switch (sub.status) {
    case 'ACTIVE':
    case 'PAST_DUE':
      return sub.planTier
    case 'TRIALING':
      return sub.trialEndsAt && sub.trialEndsAt.getTime() > now.getTime()
        ? sub.planTier
        : 'FREE'
    case 'CANCELED':
    case 'INCOMPLETE':
      return 'FREE'
    default:
      return 'FREE'
  }
}

export interface Entitlements {
  tier: PlanTierKey
  status: string
  limits: Record<LimitKey, number | null>
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  stripeConfigured: boolean
}

/** Resolve a workspace's effective entitlements from its Subscription row. */
export async function getEntitlements(workspaceId: string): Promise<Entitlements> {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } })
  const tier = resolveEffectiveTier(
    sub
      ? { planTier: sub.planTier, status: sub.status, trialEndsAt: sub.trialEndsAt }
      : null
  )
  return {
    tier,
    // No row = the workspace predates billing → it is a FREE/ACTIVE tenant.
    status: sub?.status ?? 'ACTIVE',
    limits: PLAN_LIMITS[tier],
    trialEndsAt: sub?.trialEndsAt ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    stripeConfigured: isStripeConfigured(),
  }
}

/** First instant of the current calendar month (server time). */
function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/** Count REAL current usage for one limit key. */
async function countUsage(workspaceId: string, key: LimitKey): Promise<number> {
  switch (key) {
    case 'socialAccounts':
      return prisma.socialAccount.count({ where: { workspaceId } })
    case 'postsPerMonth':
      return prisma.post.count({
        where: { workspaceId, createdAt: { gte: startOfCurrentMonth() } },
      })
    case 'teamSeats': {
      // A seat is a member OR a pending invitation (InvitationStatus.PENDING)
      // — otherwise an owner could out-invite their plan before anyone accepts.
      const [members, pendingInvites] = await Promise.all([
        prisma.userWorkspace.count({ where: { workspaceId } }),
        prisma.teamInvitation.count({ where: { workspaceId, status: 'PENDING' } }),
      ])
      return members + pendingInvites
    }
    case 'aiCreditsPerMonth':
      // 1 credit = 1 AIUsageTracking row (one AI request) this calendar month.
      return prisma.aIUsageTracking.count({
        where: { workspaceId, createdAt: { gte: startOfCurrentMonth() } },
      })
  }
}

/** Current real usage for every limit key. */
export async function getUsage(workspaceId: string): Promise<Record<LimitKey, number>> {
  const [socialAccounts, postsPerMonth, teamSeats, aiCreditsPerMonth] =
    await Promise.all([
      countUsage(workspaceId, 'socialAccounts'),
      countUsage(workspaceId, 'postsPerMonth'),
      countUsage(workspaceId, 'teamSeats'),
      countUsage(workspaceId, 'aiCreditsPerMonth'),
    ])
  return { socialAccounts, postsPerMonth, teamSeats, aiCreditsPerMonth }
}

/** Thrown by assertWithinLimit when a plan limit is reached. */
export class LimitExceededError extends Error {
  constructor(
    public limit: LimitKey,
    public current: number,
    public max: number
  ) {
    super(`Plan limit exceeded: ${limit} (${current}/${max})`)
    this.name = 'LimitExceededError'
  }
}

/**
 * Throws LimitExceededError when the workspace has reached the limit for
 * `key` under its effective tier. No-op when the limit is null (unlimited).
 * Call BEFORE creating the resource (checks current >= max).
 */
export async function assertWithinLimit(
  workspaceId: string,
  key: LimitKey
): Promise<void> {
  const entitlements = await getEntitlements(workspaceId)
  const max = entitlements.limits[key]
  if (max === null) return // unlimited
  const current = await countUsage(workspaceId, key)
  if (current >= max) {
    throw new LimitExceededError(key, current, max)
  }
}

/** Thrown by assertPlanFeature when the tier lacks a boolean feature (ADR-0020). */
export class PlanFeatureError extends Error {
  constructor(
    public feature: FeatureKey,
    public tier: PlanTierKey
  ) {
    super(`Plan feature not available on ${tier}: ${feature}`)
    this.name = 'PlanFeatureError'
  }
}

/**
 * Throws PlanFeatureError when the workspace's effective tier does not
 * include the boolean feature `key` (ADR-0020, e.g. 'clientPortal').
 */
export async function assertPlanFeature(
  workspaceId: string,
  key: FeatureKey
): Promise<void> {
  const entitlements = await getEntitlements(workspaceId)
  if (!PLAN_FEATURES[entitlements.tier][key]) {
    throw new PlanFeatureError(key, entitlements.tier)
  }
}

/** Standard 402 response for a PlanFeatureError (mirrors limit_exceeded). */
export function planFeatureResponse(err: PlanFeatureError): NextResponse {
  return NextResponse.json(
    {
      error: 'feature_not_in_plan',
      feature: err.feature,
      tier: err.tier,
      upgradeUrl: '/dashboard/billing',
    },
    { status: 402 }
  )
}

/** Standard 402 response for a LimitExceededError. */
export function limitExceededResponse(err: LimitExceededError): NextResponse {
  return NextResponse.json(
    {
      error: 'limit_exceeded',
      limit: err.limit,
      current: err.current,
      max: err.max,
      upgradeUrl: '/dashboard/billing',
    },
    { status: 402 }
  )
}
