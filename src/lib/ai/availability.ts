// AI availability contract (ADR-0018).
//
// Single source of truth for whether AI features can run and which provider
// backs them. Dependency-light BY DESIGN: this module imports ONLY
// '@/lib/config/demo' so that route guards, services, and providers can all
// share it without import cycles.
//
// Three-state behavior:
// - OPENAI_API_KEY set (and not the .env.example placeholder) → real OpenAI.
// - No key, but demo mode (NODE_ENV=development or ENABLE_DEMO='true')
//   → mock provider with clearly-labeled simulated output.
// - Otherwise (production without a key, NODE_ENV=test) → unavailable;
//   routes return an honest 503 instead of fabricated results.

import { isDemoMode } from '@/lib/config/demo'

export type AIAvailability = {
  available: boolean
  provider: 'openai' | 'mock' | 'none'
  reason?: string
}

/** Thrown when AI is invoked with no provider available (no key, not demo). */
export class AIUnavailableError extends Error {
  constructor(message = 'AI features are unavailable — configure OPENAI_API_KEY') {
    super(message)
    this.name = 'AIUnavailableError'
  }
}

/**
 * Thrown by the workspace monthly-spend backstop (AI_MONTHLY_COST_LIMIT_CENTS)
 * when this calendar month's tracked AI cost for a workspace has reached the
 * configured ceiling. Plan-tier CREDIT limits (ADR-0019) remain the primary
 * control; this is a cost backstop, OFF by default when the env is unset.
 * mapAIError() converts it to 429 { error: 'AI_QUOTA_EXCEEDED', ... }.
 */
export class AIQuotaExceededError extends Error {
  constructor(
    public limitCents: number,
    public usedCents: number
  ) {
    super(`AI monthly cost limit exceeded (${usedCents}/${limitCents} cents)`)
    this.name = 'AIQuotaExceededError'
  }
}

const PLACEHOLDER_KEY = 'your-openai-api-key-here'

export function getAIAvailability(): AIAvailability {
  const key = process.env.OPENAI_API_KEY
  if (key && key !== PLACEHOLDER_KEY) {
    return { available: true, provider: 'openai' }
  }
  if (isDemoMode()) {
    return {
      available: true,
      provider: 'mock',
      reason: 'demo mode — simulated output',
    }
  }
  return {
    available: false,
    provider: 'none',
    reason: 'Configure OPENAI_API_KEY to enable AI features',
  }
}
