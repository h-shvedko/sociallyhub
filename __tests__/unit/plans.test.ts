/**
 * Unit tests for src/lib/billing/plans.ts (ADR-0021 Track C, coded against
 * the shared billing contract).
 *
 * priceIdForTier reads env (STRIPE_PRICE_PRO_MONTHLY /
 * STRIPE_PRICE_BUSINESS_MONTHLY); tierForPriceId maps a Stripe price id back
 * to a tier. Env is saved/restored around every test, and the module is
 * re-required per test via jest.isolateModules so module-level env caching
 * (if any) cannot leak between cases.
 */

const PRO_PRICE = "price_test_pro_monthly"
const BUSINESS_PRICE = "price_test_business_monthly"

let savedPro: string | undefined
let savedBusiness: string | undefined

function setPriceEnv(pro?: string, business?: string) {
  if (pro === undefined) delete process.env.STRIPE_PRICE_PRO_MONTHLY
  else process.env.STRIPE_PRICE_PRO_MONTHLY = pro
  if (business === undefined) delete process.env.STRIPE_PRICE_BUSINESS_MONTHLY
  else process.env.STRIPE_PRICE_BUSINESS_MONTHLY = business
}

function loadPlans(): typeof import("@/lib/billing/plans") {
  let mod: typeof import("@/lib/billing/plans")
  jest.isolateModules(() => {
    mod = require("@/lib/billing/plans")
  })
  return mod!
}

beforeEach(() => {
  savedPro = process.env.STRIPE_PRICE_PRO_MONTHLY
  savedBusiness = process.env.STRIPE_PRICE_BUSINESS_MONTHLY
})

afterEach(() => {
  setPriceEnv(savedPro, savedBusiness)
})

describe("priceIdForTier", () => {
  it("returns the configured price ids when env vars are set", () => {
    setPriceEnv(PRO_PRICE, BUSINESS_PRICE)
    const { priceIdForTier } = loadPlans()
    expect(priceIdForTier("PRO")).toBe(PRO_PRICE)
    expect(priceIdForTier("BUSINESS")).toBe(BUSINESS_PRICE)
  })

  it("returns null (never a fabricated id) when env vars are unset", () => {
    setPriceEnv(undefined, undefined)
    const { priceIdForTier } = loadPlans()
    expect(priceIdForTier("PRO")).toBeNull()
    expect(priceIdForTier("BUSINESS")).toBeNull()
  })

  it("handles one tier configured and the other not", () => {
    setPriceEnv(PRO_PRICE, undefined)
    const { priceIdForTier } = loadPlans()
    expect(priceIdForTier("PRO")).toBe(PRO_PRICE)
    expect(priceIdForTier("BUSINESS")).toBeNull()
  })
})

describe("tierForPriceId", () => {
  it("round-trips priceIdForTier for both paid tiers", () => {
    setPriceEnv(PRO_PRICE, BUSINESS_PRICE)
    const { priceIdForTier, tierForPriceId } = loadPlans()
    for (const tier of ["PRO", "BUSINESS"] as const) {
      expect(tierForPriceId(priceIdForTier(tier)!)).toBe(tier)
    }
  })

  it("returns null for an unknown price id", () => {
    setPriceEnv(PRO_PRICE, BUSINESS_PRICE)
    const { tierForPriceId } = loadPlans()
    expect(tierForPriceId("price_someone_elses")).toBeNull()
  })

  it("returns null when env vars are unset (no accidental match on undefined)", () => {
    setPriceEnv(undefined, undefined)
    const { tierForPriceId } = loadPlans()
    expect(tierForPriceId(PRO_PRICE)).toBeNull()
    expect(tierForPriceId("")).toBeNull()
  })
})

describe("display prices (user-visible promises)", () => {
  it("pins PLAN_PRICES_USD", () => {
    const { PLAN_PRICES_USD } = loadPlans()
    expect(PLAN_PRICES_USD).toEqual({ FREE: 0, PRO: 29, BUSINESS: 79 })
  })
})
