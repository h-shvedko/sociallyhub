import OpenAI from 'openai'

// LAZY singleton (ADR-0022 build fix): this module used to construct the
// client — and even `throw` on a missing OPENAI_API_KEY — at MODULE SCOPE.
// `next build` imports every route during page-data collection, so any build
// environment without the key (the production Docker image build, CI) died
// with "Failed to collect page data for /api/ai/images/analyze". Construction
// now happens on first USE: importing is always safe, and calling without a
// key throws the same honest error at request time (surfaced as AI
// unavailability — full policy is ADR-0018 scope).
let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set — AI features are unavailable'
      )
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

// Proxy keeps the existing `openai.chat.completions...` call sites working
// unchanged while deferring construction until the first property access.
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<PropertyKey, unknown>
    const value = client[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
})

export default openai