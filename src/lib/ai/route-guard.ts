// Route-level AI availability guard + response meta (ADR-0018 Track A).
//
// Every /api/ai/** route:
// 1. calls guardAIAvailability() at the top of the handler — provider 'none'
//    → honest 503 BEFORE any work;
// 2. stamps success bodies with withAIMeta() so clients always see
//    { aiProvider, simulated } at the top level;
// 3. routes thrown errors through mapAIError() before falling back to
//    handleApiError().

import { NextResponse } from 'next/server'

import {
  AIQuotaExceededError,
  AIUnavailableError,
  getAIAvailability,
} from './availability'
import {
  LimitExceededError,
  limitExceededResponse,
} from '@/lib/billing/entitlements'

function aiUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'AI_UNAVAILABLE',
      message: 'Configure OPENAI_API_KEY to enable AI features',
    },
    { status: 503 }
  )
}

/**
 * Returns null when AI can run (provider 'openai' or 'mock');
 * returns the 503 AI_UNAVAILABLE response when provider is 'none'.
 */
export function guardAIAvailability(): NextResponse | null {
  const availability = getAIAvailability()
  if (availability.provider === 'none') {
    return aiUnavailableResponse()
  }
  return null
}

/**
 * Stamps the standard AI meta fields onto a success body:
 * aiProvider ('openai' | 'mock' | 'none') and simulated (true when mock).
 */
export function withAIMeta<T extends object>(
  body: T
): T & { aiProvider: 'openai' | 'mock' | 'none'; simulated: boolean } {
  const availability = getAIAvailability()
  return {
    ...body,
    aiProvider: availability.provider,
    simulated: availability.provider === 'mock',
  }
}

/**
 * Maps typed AI errors to responses:
 * - AIUnavailableError → the same 503 as guardAIAvailability()
 * - AIQuotaExceededError → 429 { error: 'AI_QUOTA_EXCEEDED', limitCents, usedCents }
 * - LimitExceededError (ADR-0019 plan credits) → 402 limitExceededResponse
 * - anything else → null (caller falls through to handleApiError)
 */
export function mapAIError(error: unknown): NextResponse | null {
  if (error instanceof AIUnavailableError) {
    return aiUnavailableResponse()
  }
  if (error instanceof AIQuotaExceededError) {
    return NextResponse.json(
      {
        error: 'AI_QUOTA_EXCEEDED',
        limitCents: error.limitCents,
        usedCents: error.usedCents,
      },
      { status: 429 }
    )
  }
  if (error instanceof LimitExceededError) {
    return limitExceededResponse(error)
  }
  return null
}
