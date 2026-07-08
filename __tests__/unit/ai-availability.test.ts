/**
 * @jest-environment node
 *
 * ADR-0018 Track E — unit tests for the AI availability contract.
 *
 * Exercises the pinned contract surface:
 *   - src/lib/ai/availability.ts  → getAIAvailability(), AIUnavailableError
 *   - src/lib/ai/config.ts        → getAIModel(), getAIVisionModel(),
 *                                   COST_ESTIMATES, estimateCostCents()
 *   - src/lib/ai/route-guard.ts   → guardAIAvailability(), withAIMeta(),
 *                                   mapAIError()
 *
 * ENV-ISOLATION PATTERN (important): the AI layer caches module-level state at
 * import time — e.g. src/lib/ai/config.ts memoizes the OpenAI client singleton
 * keyed off OPENAI_API_KEY. Every test therefore (1) mutates process.env FIRST
 * and (2) loads the modules under test via jest.isolateModules() so a fresh
 * registry re-evaluates all module-level state. All contract modules are loaded
 * inside the SAME isolateModules callback so `instanceof` checks
 * (mapAIError ↔ AIUnavailableError) see one class identity.
 *
 * Demo gating is now the single DEMO_MODE flag (isDemoMode() ===
 * process.env.DEMO_MODE === 'true') — the previous NODE_ENV heuristic and the
 * demo-backdoor env var it relied on have both been removed (ADR-0025).
 */
import { describe, it, expect, beforeEach, afterAll } from '@jest/globals'

const ORIGINAL_ENV = { ...process.env }

// beforeEach REPLACES the process.env object, so never hold a reference to
// it — always go through these helpers, which cast at call time (NODE_ENV is
// typed readonly by Next's env types).
function setEnv(key: string, value: string) {
  ;(process.env as Record<string, string | undefined>)[key] = value
}
function deleteEnv(key: string) {
  delete (process.env as Record<string, string | undefined>)[key]
}

/** Known baseline: no key, demo off (DEMO_MODE unset), NODE_ENV as given. */
function resetAIEnv(nodeEnv: string = 'test') {
  deleteEnv('OPENAI_API_KEY')
  deleteEnv('OPENAI_MODEL')
  deleteEnv('OPENAI_VISION_MODEL')
  deleteEnv('DEMO_MODE')
  setEnv('NODE_ENV', nodeEnv)
}

type AvailabilityModule = typeof import('@/lib/ai/availability')
type ConfigModule = typeof import('@/lib/ai/config')
type RouteGuardModule = typeof import('@/lib/ai/route-guard')
type EntitlementsModule = typeof import('@/lib/billing/entitlements')

interface AIModules {
  availability: AvailabilityModule
  config: ConfigModule
  routeGuard: RouteGuardModule
  entitlements: EntitlementsModule
}

/**
 * Load all contract modules in one fresh, shared registry so module-level
 * state re-evaluates against the CURRENT process.env and class identities
 * stay consistent across the modules.
 */
function loadAI(): AIModules {
  let mods!: AIModules
  jest.isolateModules(() => {
    mods = {
      availability: require('@/lib/ai/availability'),
      config: require('@/lib/ai/config'),
      routeGuard: require('@/lib/ai/route-guard'),
      entitlements: require('@/lib/billing/entitlements'),
    }
  })
  return mods
}

beforeEach(() => {
  jest.resetModules()
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv
  resetAIEnv('test')
})

afterAll(() => {
  process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv
})

// ---------------------------------------------------------------------------
// getAIAvailability() matrix
// ---------------------------------------------------------------------------

describe('getAIAvailability()', () => {
  it('returns { available:true, provider:"openai" } when OPENAI_API_KEY is set', () => {
    setEnv('OPENAI_API_KEY', 'sk-unit-test-key')
    const { availability } = loadAI()
    const result = availability.getAIAvailability()
    expect(result.available).toBe(true)
    expect(result.provider).toBe('openai')
  })

  it('treats the placeholder "your-openai-api-key-here" as NO key (provider none outside demo)', () => {
    setEnv('OPENAI_API_KEY', 'your-openai-api-key-here')
    // no DEMO_MODE → not demo mode
    const { availability } = loadAI()
    const result = availability.getAIAvailability()
    expect(result.available).toBe(false)
    expect(result.provider).toBe('none')
  })

  it('returns mock provider when no key and DEMO_MODE="true"', () => {
    setEnv('DEMO_MODE', 'true')
    const { availability } = loadAI()
    const result = availability.getAIAvailability()
    expect(result.available).toBe(true)
    expect(result.provider).toBe('mock')
    expect(result.reason).toBeTruthy() // "demo mode — simulated output"
  })

  it('returns mock provider when no key and DEMO_MODE="true", regardless of NODE_ENV', () => {
    // NODE_ENV no longer influences demo gating (ADR-0025) — only DEMO_MODE does.
    setEnv('NODE_ENV', 'production')
    setEnv('DEMO_MODE', 'true')
    const { availability } = loadAI()
    const result = availability.getAIAvailability()
    expect(result.available).toBe(true)
    expect(result.provider).toBe('mock')
  })

  it('returns { available:false, provider:"none" } with an honest reason when no key and no DEMO_MODE', () => {
    const { availability } = loadAI()
    const result = availability.getAIAvailability()
    expect(result.available).toBe(false)
    expect(result.provider).toBe('none')
    expect(result.reason).toMatch(/OPENAI_API_KEY/)
  })
})

// ---------------------------------------------------------------------------
// config: model resolution + cost estimation
// ---------------------------------------------------------------------------

describe('AI config', () => {
  it('getAIModel() defaults to gpt-4o-mini and honors OPENAI_MODEL', () => {
    const { config } = loadAI()
    expect(config.getAIModel()).toBe('gpt-4o-mini')

    setEnv('OPENAI_MODEL', 'gpt-4.1-unit-test')
    const { config: config2 } = loadAI()
    expect(config2.getAIModel()).toBe('gpt-4.1-unit-test')
  })

  it('getAIVisionModel() defaults to gpt-4o-mini and honors OPENAI_VISION_MODEL', () => {
    const { config } = loadAI()
    expect(config.getAIVisionModel()).toBe('gpt-4o-mini')

    setEnv('OPENAI_VISION_MODEL', 'gpt-4o-vision-unit-test')
    const { config: config2 } = loadAI()
    expect(config2.getAIVisionModel()).toBe('gpt-4o-vision-unit-test')
  })

  it('COST_ESTIMATES includes gpt-4o-mini plus the legacy entries', () => {
    const { config } = loadAI()
    for (const model of ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo-preview']) {
      expect(config.COST_ESTIMATES[model]).toBeDefined()
      expect(config.COST_ESTIMATES[model].input).toBeGreaterThan(0)
      expect(config.COST_ESTIMATES[model].output).toBeGreaterThan(0)
    }
  })

  it('estimateCostCents() returns > 0 for known models', () => {
    const { config } = loadAI()
    expect(config.estimateCostCents('gpt-4o-mini', 1000, 1000)).toBeGreaterThan(0)
    expect(config.estimateCostCents('gpt-4', 1000, 1000)).toBeGreaterThan(0)
    expect(config.estimateCostCents('gpt-3.5-turbo', 1000, 1000)).toBeGreaterThan(0)
  })

  it('estimateCostCents() for an UNKNOWN model is a conservative (gpt-4-level) estimate, never 0', () => {
    const { config } = loadAI()
    const unknown = config.estimateCostCents('totally-unknown-model-xyz', 1000, 1000)
    expect(unknown).toBeGreaterThan(0)
    // Conservative = at least as expensive as the cheap default model.
    expect(unknown).toBeGreaterThanOrEqual(
      config.estimateCostCents('gpt-4o-mini', 1000, 1000)
    )
  })
})

// ---------------------------------------------------------------------------
// route-guard: guardAIAvailability / withAIMeta / mapAIError
// ---------------------------------------------------------------------------

describe('route-guard', () => {
  it('guardAIAvailability() returns null when the provider is openai', () => {
    setEnv('OPENAI_API_KEY', 'sk-unit-test-key')
    const { routeGuard } = loadAI()
    expect(routeGuard.guardAIAvailability()).toBeNull()
  })

  it('guardAIAvailability() returns null when the provider is mock (demo)', () => {
    setEnv('DEMO_MODE', 'true')
    const { routeGuard } = loadAI()
    expect(routeGuard.guardAIAvailability()).toBeNull()
  })

  it('guardAIAvailability() returns a 503 AI_UNAVAILABLE response when provider is none', async () => {
    const { routeGuard } = loadAI()
    const res = routeGuard.guardAIAvailability()
    expect(res).not.toBeNull()
    expect(res!.status).toBe(503)
    const body = await res!.json()
    expect(body.error).toBe('AI_UNAVAILABLE')
    expect(body.message).toMatch(/OPENAI_API_KEY/)
  })

  it('withAIMeta() stamps aiProvider:"openai" + simulated:false when a key is set', () => {
    setEnv('OPENAI_API_KEY', 'sk-unit-test-key')
    const { routeGuard } = loadAI()
    const stamped = routeGuard.withAIMeta({ success: true, data: { x: 1 } })
    expect(stamped.aiProvider).toBe('openai')
    expect(stamped.simulated).toBe(false)
    // Original fields survive.
    expect(stamped.success).toBe(true)
    expect(stamped.data).toEqual({ x: 1 })
  })

  it('withAIMeta() stamps aiProvider:"mock" + simulated:true in demo mode without a key', () => {
    setEnv('DEMO_MODE', 'true')
    const { routeGuard } = loadAI()
    const stamped = routeGuard.withAIMeta({ success: true })
    expect(stamped.aiProvider).toBe('mock')
    expect(stamped.simulated).toBe(true)
  })

  it('mapAIError() maps AIUnavailableError to the 503 AI_UNAVAILABLE response', async () => {
    // availability + route-guard loaded in the SAME registry → instanceof works.
    const { availability, routeGuard } = loadAI()
    const res = routeGuard.mapAIError(new availability.AIUnavailableError())
    expect(res).not.toBeNull()
    expect(res!.status).toBe(503)
    const body = await res!.json()
    expect(body.error).toBe('AI_UNAVAILABLE')
  })

  it('mapAIError() maps billing LimitExceededError to the standard 402 response', async () => {
    const { routeGuard, entitlements } = loadAI()
    const err = new entitlements.LimitExceededError('aiCreditsPerMonth', 20, 20)
    const res = routeGuard.mapAIError(err)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(402)
    const body = await res!.json()
    expect(body.error).toBe('limit_exceeded')
    expect(body.limit).toBe('aiCreditsPerMonth')
  })

  it('mapAIError() returns null for unrelated errors (caller falls through to handleApiError)', () => {
    const { routeGuard } = loadAI()
    expect(routeGuard.mapAIError(new Error('boom'))).toBeNull()
    expect(routeGuard.mapAIError('not-even-an-error')).toBeNull()
  })
})
