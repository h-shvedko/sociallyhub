/**
 * @jest-environment node
 *
 * Unit tests for the ADR-0020 boolean plan-feature surface:
 * - PLAN_FEATURES matrix in src/lib/billing/plans.ts
 * - PlanFeatureError + planFeatureResponse in src/lib/billing/entitlements.ts
 *
 * resolveEffectiveTier / PLAN_LIMITS / assertWithinLimit are already covered
 * by __tests__/unit/entitlements.test.ts and plans.test.ts — only the NEW
 * feature-gating surface is pinned here.
 */
import { describe, it, expect } from '@jest/globals'

import { PLAN_FEATURES } from '@/lib/billing/plans'
import { PlanFeatureError, planFeatureResponse } from '@/lib/billing/entitlements'

describe('PLAN_FEATURES (pinned — the ADR-0020 feature matrix is a user-visible promise)', () => {
  it('matches the published matrix exactly', () => {
    expect(PLAN_FEATURES).toEqual({
      FREE: { clientPortal: false },
      PRO: { clientPortal: true },
      BUSINESS: { clientPortal: true },
    })
  })

  it('FREE lacks clientPortal', () => {
    expect(PLAN_FEATURES.FREE.clientPortal).toBe(false)
  })

  it('PRO and BUSINESS include clientPortal', () => {
    expect(PLAN_FEATURES.PRO.clientPortal).toBe(true)
    expect(PLAN_FEATURES.BUSINESS.clientPortal).toBe(true)
  })
})

describe('PlanFeatureError', () => {
  it('carries the feature and tier, and is a real Error', () => {
    const err = new PlanFeatureError('clientPortal', 'FREE')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('PlanFeatureError')
    expect(err.feature).toBe('clientPortal')
    expect(err.tier).toBe('FREE')
    expect(err.message).toContain('clientPortal')
    expect(err.message).toContain('FREE')
  })
})

describe('planFeatureResponse', () => {
  it("returns 402 with the contract body { error: 'feature_not_in_plan', feature, tier, upgradeUrl }", async () => {
    const res = planFeatureResponse(new PlanFeatureError('clientPortal', 'FREE'))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body).toEqual({
      error: 'feature_not_in_plan',
      feature: 'clientPortal',
      tier: 'FREE',
      upgradeUrl: '/dashboard/billing',
    })
  })
})
