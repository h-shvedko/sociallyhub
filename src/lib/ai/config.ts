// OpenAI client + model policy + cost knowledge (ADR-0018 Track A).
//
// HONESTY RULES:
// - No module-scope client construction (ADR-0022 build lesson) and no fake
//   'sk-fake-key-for-demo' fallback: without a real key, using the client
//   throws a typed AIUnavailableError at CALL time.
// - Cost knowledge lives in ONE table here (COST_ESTIMATES, USD per 1K
//   tokens) with estimateCostCents() as the single conversion point.

import OpenAI from 'openai'
import { AIUnavailableError } from './availability'

const PLACEHOLDER_KEY = 'your-openai-api-key-here'

let clientSingleton: OpenAI | null = null

/**
 * Lazy OpenAI client singleton. Throws AIUnavailableError when no real
 * OPENAI_API_KEY is configured — callers must guard via getAIAvailability()
 * (or catch and map through mapAIError()).
 */
export function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY
  if (!key || key === PLACEHOLDER_KEY) {
    throw new AIUnavailableError()
  }
  if (!clientSingleton) {
    clientSingleton = new OpenAI({ apiKey: key })
  }
  return clientSingleton
}

/**
 * BACKWARD-COMPAT lazy proxy so existing `import { openai } from './config'`
 * consumers keep compiling. Every property access resolves the real lazy
 * client, so calls without a configured key throw AIUnavailableError at call
 * time (honest) instead of silently hitting the API with a fake key.
 *
 * Do NOT add new usages — new code calls getOpenAIClient() directly
 * (Track C migrates the remaining consumers).
 */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getOpenAIClient()
    const value = Reflect.get(client as object, prop, client)
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
  has(_target, prop) {
    return Reflect.has(getOpenAIClient() as object, prop)
  },
})

/** Chat/completions model policy: OPENAI_MODEL env override, gpt-4o-mini default. */
export function getAIModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini'
}

/** Vision model policy: OPENAI_VISION_MODEL env override, gpt-4o-mini default. */
export function getAIVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini'
}

// AI defaults (models map defers to getAIModel()/getAIVisionModel()).
export const AI_CONFIG = {
  get models() {
    return {
      default: getAIModel(),
      vision: getAIVisionModel(),
      // Legacy aliases — all model selection now flows through getAIModel().
      gpt4: getAIModel(),
      gpt35Turbo: getAIModel(),
      gpt4Turbo: getAIModel(),
    }
  },
  maxTokens: {
    content: 2000,
    analysis: 1000,
    response: 500,
  },
  temperature: {
    creative: 0.7,
    analytical: 0.3,
    precise: 0.1,
  },
}

// Rate limiting configuration
export const RATE_LIMITS = {
  requests_per_minute: 60,
  tokens_per_minute: 10000,
  requests_per_hour: 1000,
}

/**
 * The ONE cost table: USD per 1K tokens (input/output).
 * Rough public list prices — estimates for budgeting, not billing.
 */
export const COST_ESTIMATES: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
}

/**
 * Estimate cost in whole cents for a call. Unknown model ids get a
 * conservative gpt-4-level estimate (never a silent 0 like the old table).
 * Rounds UP so any nonzero usage records at least 1 cent.
 */
export function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = COST_ESTIMATES[model] ?? COST_ESTIMATES['gpt-4']
  const usd =
    (Math.max(0, inputTokens) / 1000) * pricing.input +
    (Math.max(0, outputTokens) / 1000) * pricing.output
  if (usd <= 0) return 0
  return Math.ceil(usd * 100)
}
