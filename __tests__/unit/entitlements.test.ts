/**
 * Unit tests for src/lib/billing/entitlements.ts + PLAN_LIMITS (ADR-0021
 * Track C, coded STRICTLY against the shared billing contract).
 *
 * No DB: prisma is mocked at the '@/lib/prisma' boundary with the exact
 * counters the contract names for getUsage/assertWithinLimit
 * (socialAccount.count, post.count, userWorkspace.count,
 * teamInvitation.count, aIUsageTracking.count) plus subscription.findUnique
 * for tier resolution.
 */

jest.mock("@/lib/prisma", () => {
  // Defined inside the factory: jest.mock is hoisted above imports, so an
  // outer `const` would not be initialized yet when the factory runs.
  const p = {
    subscription: { findUnique: jest.fn() },
    socialAccount: { count: jest.fn() },
    post: { count: jest.fn() },
    userWorkspace: { count: jest.fn() },
    teamInvitation: { count: jest.fn() },
    aIUsageTracking: { count: jest.fn() },
  }
  return { prisma: p, default: p }
})

import { prisma } from "@/lib/prisma"

import { PLAN_LIMITS } from "@/lib/billing/plans"
import {
  LimitExceededError,
  assertWithinLimit,
  limitExceededResponse,
  resolveEffectiveTier,
} from "@/lib/billing/entitlements"

const mockPrisma = prisma as unknown as {
  subscription: { findUnique: jest.Mock }
  socialAccount: { count: jest.Mock }
  post: { count: jest.Mock }
  userWorkspace: { count: jest.Mock }
  teamInvitation: { count: jest.Mock }
  aIUsageTracking: { count: jest.Mock }
}

const NOW = new Date("2026-07-07T12:00:00Z")
const FUTURE = new Date("2026-08-01T00:00:00Z")
const PAST = new Date("2026-06-01T00:00:00Z")
const WORKSPACE_ID = "ws-entitlements-test"

function sub(planTier: "FREE" | "PRO" | "BUSINESS", status: string, trialEndsAt: Date | null = null) {
  return { planTier, status, trialEndsAt }
}

beforeEach(() => {
  jest.clearAllMocks()
  // Baseline: no subscription row (FREE tier), zero usage everywhere.
  mockPrisma.subscription.findUnique.mockResolvedValue(null)
  mockPrisma.socialAccount.count.mockResolvedValue(0)
  mockPrisma.post.count.mockResolvedValue(0)
  mockPrisma.userWorkspace.count.mockResolvedValue(0)
  mockPrisma.teamInvitation.count.mockResolvedValue(0)
  mockPrisma.aIUsageTracking.count.mockResolvedValue(0)
})

describe("PLAN_LIMITS (pinned — these numbers are user-visible promises)", () => {
  it("matches the published plan matrix exactly", () => {
    expect(PLAN_LIMITS).toEqual({
      FREE: { socialAccounts: 3, postsPerMonth: 10, teamSeats: 1, aiCreditsPerMonth: 20 },
      PRO: { socialAccounts: 15, postsPerMonth: 100, teamSeats: 5, aiCreditsPerMonth: 500 },
      BUSINESS: { socialAccounts: 50, postsPerMonth: null, teamSeats: 25, aiCreditsPerMonth: 2000 },
    })
  })
})

describe("resolveEffectiveTier (pure tier matrix)", () => {
  it("null subscription → FREE", () => {
    expect(resolveEffectiveTier(null, NOW)).toBe("FREE")
  })

  it("CANCELED → FREE regardless of planTier", () => {
    expect(resolveEffectiveTier(sub("PRO", "CANCELED"), NOW)).toBe("FREE")
    expect(resolveEffectiveTier(sub("BUSINESS", "CANCELED"), NOW)).toBe("FREE")
  })

  it("INCOMPLETE → FREE regardless of planTier", () => {
    expect(resolveEffectiveTier(sub("PRO", "INCOMPLETE"), NOW)).toBe("FREE")
  })

  it("ACTIVE → the subscribed tier", () => {
    expect(resolveEffectiveTier(sub("PRO", "ACTIVE"), NOW)).toBe("PRO")
    expect(resolveEffectiveTier(sub("BUSINESS", "ACTIVE"), NOW)).toBe("BUSINESS")
  })

  it("PAST_DUE keeps the subscribed tier (grace, not an instant downgrade)", () => {
    expect(resolveEffectiveTier(sub("BUSINESS", "PAST_DUE"), NOW)).toBe("BUSINESS")
  })

  it("TRIALING with trialEndsAt in the future → the subscribed tier", () => {
    expect(resolveEffectiveTier(sub("PRO", "TRIALING", FUTURE), NOW)).toBe("PRO")
  })

  it("TRIALING with an expired trialEndsAt → FREE", () => {
    expect(resolveEffectiveTier(sub("PRO", "TRIALING", PAST), NOW)).toBe("FREE")
  })

  it("TRIALING with no trialEndsAt → FREE (no open-ended free trials)", () => {
    expect(resolveEffectiveTier(sub("PRO", "TRIALING", null), NOW)).toBe("FREE")
  })
})

describe("assertWithinLimit (mocked prisma counts, FREE tier: 3 social accounts)", () => {
  it("resolves when usage is under the limit", async () => {
    mockPrisma.socialAccount.count.mockResolvedValue(2)
    await expect(assertWithinLimit(WORKSPACE_ID, "socialAccounts")).resolves.toBeUndefined()
  })

  it("throws LimitExceededError when usage is AT the limit (current >= max)", async () => {
    mockPrisma.socialAccount.count.mockResolvedValue(3)
    const promise = assertWithinLimit(WORKSPACE_ID, "socialAccounts")
    await expect(promise).rejects.toBeInstanceOf(LimitExceededError)
    await expect(promise).rejects.toMatchObject({
      limit: "socialAccounts",
      current: 3,
      max: 3,
    })
  })

  it("throws when usage is over the limit, reporting the real current count", async () => {
    mockPrisma.socialAccount.count.mockResolvedValue(7)
    await expect(assertWithinLimit(WORKSPACE_ID, "socialAccounts")).rejects.toMatchObject({
      limit: "socialAccounts",
      current: 7,
      max: 3,
    })
  })

  it("is a no-op for an unlimited (null) limit — BUSINESS postsPerMonth", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      planTier: "BUSINESS",
      status: "ACTIVE",
      trialEndsAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripePriceId: null,
    })
    mockPrisma.post.count.mockResolvedValue(999999)
    await expect(assertWithinLimit(WORKSPACE_ID, "postsPerMonth")).resolves.toBeUndefined()
  })

  it("enforces the effective (FREE) limits when a subscription is CANCELED", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      planTier: "BUSINESS",
      status: "CANCELED",
      trialEndsAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripePriceId: null,
    })
    mockPrisma.socialAccount.count.mockResolvedValue(3) // >= FREE max of 3
    await expect(assertWithinLimit(WORKSPACE_ID, "socialAccounts")).rejects.toMatchObject({
      max: 3,
    })
  })
})

describe("limitExceededResponse", () => {
  it("returns the contract's 402 JSON shape", async () => {
    const res = limitExceededResponse(new LimitExceededError("socialAccounts", 3, 3))
    expect(res.status).toBe(402)
    await expect(res.json()).resolves.toEqual({
      error: "limit_exceeded",
      limit: "socialAccounts",
      current: 3,
      max: 3,
      upgradeUrl: "/dashboard/billing",
    })
  })
})
