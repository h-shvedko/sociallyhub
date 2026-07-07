'use client'

import { useEffect, useState } from 'react'

// Mirrors the ADR-0018 AI availability contract (GET /api/ai/status).
export type AIProvider = 'openai' | 'mock' | 'none'

export interface AIStatus {
  available: boolean
  provider: AIProvider
  reason?: string
  model?: string
}

export interface UseAIStatusResult {
  /** null while the initial fetch is in flight */
  status: AIStatus | null
  loading: boolean
}

// Shared across all consumers so the composer, audience page and analytics
// tab issue at most one request per browser session.
let cachedStatus: AIStatus | null = null
let inflight: Promise<AIStatus> | null = null

async function fetchAIStatus(): Promise<AIStatus> {
  try {
    const res = await fetch('/api/ai/status')
    if (!res.ok) throw new Error(`AI status request failed (${res.status})`)
    const data = await res.json()
    const provider: AIProvider =
      data.provider === 'openai' || data.provider === 'mock' ? data.provider : 'none'
    return {
      available: provider !== 'none' && Boolean(data.available),
      provider,
      reason: typeof data.reason === 'string' ? data.reason : undefined,
      model: typeof data.model === 'string' ? data.model : undefined,
    }
  } catch {
    // Honest fail-closed: if availability cannot be determined, do not
    // pretend AI works — callers render their "unavailable" states.
    return {
      available: false,
      provider: 'none',
      reason: 'Unable to determine AI availability',
    }
  }
}

export function useAIStatus(): UseAIStatusResult {
  const [status, setStatus] = useState<AIStatus | null>(cachedStatus)

  useEffect(() => {
    if (cachedStatus) return
    if (!inflight) {
      inflight = fetchAIStatus().then((s) => {
        cachedStatus = s
        return s
      })
    }
    let active = true
    inflight.then((s) => {
      if (active) setStatus(s)
    })
    return () => {
      active = false
    }
  }, [])

  return { status, loading: status === null }
}
