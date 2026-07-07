// GET /api/ai/status — AI availability probe (ADR-0018 Track A).
//
// Authenticated: 200 { available, provider, reason?, model }.
// Unauthenticated: 401. Honest by construction — reports the real
// availability state (openai / mock-in-demo / none), never fabricates.

import { NextResponse } from 'next/server'

import { requireSession } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { getAIAvailability } from '@/lib/ai/availability'
import { getAIModel } from '@/lib/ai/config'

export async function GET() {
  try {
    await requireSession()

    const availability = getAIAvailability()
    return NextResponse.json({
      available: availability.available,
      provider: availability.provider,
      ...(availability.reason ? { reason: availability.reason } : {}),
      model: getAIModel(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
