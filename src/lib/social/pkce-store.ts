// Server-side PKCE code-verifier store, keyed by OAuth `state` (ADR-0009 Phase 0.6).
//
// OAuth 2.0 with PKCE (Twitter/X, and any S256 flow) requires the authorization
// request to carry a `code_challenge = S256(verifier)` and the later token
// exchange to present the SAME `code_verifier`. The connect request and the
// callback are two SEPARATE HTTP requests (often different processes), so the
// verifier must be persisted out-of-process between them — it CANNOT live in a
// module variable or on the provider instance (the previous
// `getStoredCodeVerifier(): 'mock_code_verifier'` stub is exactly the bug this
// replaces).
//
// Backing store: Redis (ioredis) with a 10-minute TTL, keyed `pkce:<state>` —
// matching the signed-state lifetime (`ACCOUNT_STATE_EXPIRY_MS`). No DB
// migration is introduced (HARD RULE); the verifier is short-lived, single-use
// throwaway state. When `REDIS_URL` is unset (tests / single-process dev), an
// in-memory Map with the same TTL is used so the flow still works locally.
//
// Verifiers are single-use: `getPkceVerifier` deletes the key on read, so a
// captured/replayed callback cannot reuse a verifier. The verifier is a secret
// — never logged.

import Redis from 'ioredis'

/** Redis key prefix for stored PKCE verifiers. */
const PKCE_PREFIX = 'pkce:'
/** Verifier lifetime — matches the signed OAuth-state window (10 minutes). */
const PKCE_TTL_SECONDS = 600

// ---------------------------------------------------------------------------
// Lazy Redis singleton (mirrors src/lib/utils/rate-limit.ts):
//   undefined = not yet initialized
//   null      = no REDIS_URL configured → use the in-memory fallback
//   Redis     = live client
// ---------------------------------------------------------------------------
let redisClient: Redis | null | undefined = undefined

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient

  const url = process.env.REDIS_URL
  if (!url) {
    redisClient = null
    return null
  }

  try {
    const client = new Redis(url, {
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    })
    // Never let a Redis connection error crash the process.
    client.on('error', (err: Error) => {
      console.warn('[pkce-store] Redis connection error:', err.message)
    })
    redisClient = client
    return client
  } catch (err) {
    console.warn(
      '[pkce-store] Redis init failed; using in-memory fallback:',
      err instanceof Error ? err.message : err
    )
    redisClient = null
    return null
  }
}

// In-memory fallback (no Redis configured). Values expire lazily on read.
const memoryStore = new Map<string, { verifier: string; expiresAt: number }>()

function memoryStoreSet(state: string, verifier: string): void {
  memoryStore.set(state, {
    verifier,
    expiresAt: Date.now() + PKCE_TTL_SECONDS * 1000,
  })
  // Opportunistic cleanup so abandoned flows do not leak memory.
  if (memoryStore.size > 5000) {
    const now = Date.now()
    for (const [k, v] of memoryStore.entries()) {
      if (v.expiresAt <= now) memoryStore.delete(k)
    }
  }
}

function memoryStoreTake(state: string): string | null {
  const entry = memoryStore.get(state)
  if (!entry) return null
  memoryStore.delete(state) // single-use
  if (entry.expiresAt <= Date.now()) return null
  return entry.verifier
}

/**
 * Persist the PKCE `code_verifier` for an OAuth flow, keyed by its `state`
 * token, for `PKCE_TTL_SECONDS`. Call this from the connect route right after
 * generating the verifier/challenge and before redirecting to the provider.
 */
export async function storePkceVerifier(
  state: string,
  verifier: string
): Promise<void> {
  if (!state || !verifier) {
    throw new Error('storePkceVerifier: both state and verifier are required')
  }

  const redis = getRedisClient()
  if (!redis) {
    memoryStoreSet(state, verifier)
    return
  }

  // EX = TTL in seconds; the key auto-expires if the callback never arrives.
  await redis.set(PKCE_PREFIX + state, verifier, 'EX', PKCE_TTL_SECONDS)
}

/**
 * Retrieve (and consume) the PKCE `code_verifier` for `state`. Returns `null`
 * when no verifier is stored (unknown/expired/replayed state) — the callback
 * must then fail honestly rather than attempting a token exchange it cannot
 * complete. The key is DELETED on read so a verifier is single-use.
 */
export async function getPkceVerifier(state: string): Promise<string | null> {
  if (!state) return null

  const redis = getRedisClient()
  if (!redis) {
    return memoryStoreTake(state)
  }

  const key = PKCE_PREFIX + state
  try {
    // GETDEL (Redis >= 6.2) atomically reads and deletes for single-use.
    if (typeof (redis as unknown as { getdel?: unknown }).getdel === 'function') {
      return await redis.getdel(key)
    }
    // Fallback for older Redis: read then best-effort delete.
    const value = await redis.get(key)
    if (value !== null) await redis.del(key)
    return value
  } catch (err) {
    console.warn(
      '[pkce-store] Redis read failed; treating verifier as missing:',
      err instanceof Error ? err.message : err
    )
    return null
  }
}

// Test-only hooks (parallel to rate-limit's). Not for application code.

/** Inject a fake/real Redis client (or null to force the in-memory path). */
export function __setPkceRedisForTests(client: Redis | null): void {
  redisClient = client
}

/** Clear the in-memory store and reset the client sentinel. */
export function __resetPkceStoreForTests(): void {
  memoryStore.clear()
  redisClient = undefined
}
