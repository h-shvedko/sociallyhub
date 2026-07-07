// AI Response Cache (ADR-0018 Track A).
//
// Redis-backed when REDIS_URL is set (lazy ioredis client, keys namespaced
// 'ai-cache:', JSON values with TTL via SET EX, NO cleanup interval);
// in-memory Map fallback otherwise. Fail-soft: any Redis error is logged
// ONCE and the operation falls through to the memory store, so AI features
// keep working (uncached at worst) when Redis is down.

import { createHash } from 'crypto'
import Redis from 'ioredis'
import { CacheEntry } from './types'

const KEY_PREFIX = 'ai-cache:'

let redisClient: Redis | null = null
let redisErrorLogged = false

function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) return null
  if (!redisClient) {
    // Lazy construction — never at module scope (ADR-0022 build lesson).
    redisClient = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      // Error immediately when disconnected instead of queueing forever —
      // lets the cache fail soft to memory rather than hang.
      enableOfflineQueue: false,
    })
    redisClient.on('error', (err: Error) => {
      logRedisErrorOnce(err)
    })
  }
  return redisClient
}

function logRedisErrorOnce(err: unknown): void {
  if (redisErrorLogged) return
  redisErrorLogged = true
  console.error(
    'AICache: Redis unavailable, falling back to in-memory cache:',
    err instanceof Error ? err.message : err
  )
}

export class AICache {
  private cache = new Map<string, CacheEntry>()
  private readonly defaultTTL: number
  private hits = 0
  private misses = 0

  constructor(defaultTTL: number = 3600) { // 1 hour default
    this.defaultTTL = defaultTTL
    // No setInterval: Redis expires keys natively; the memory fallback
    // cleans up opportunistically on writes (open timers leak in tests
    // and are pointless on Redis).
  }

  generateKey(method: string, params: any): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort())
    return createHash('md5').update(`${method}:${paramsStr}`).digest('hex')
  }

  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisClient()
    if (redis) {
      try {
        const raw = await redis.get(KEY_PREFIX + key)
        if (raw !== null) {
          this.hits++
          const parsed = JSON.parse(raw) as { value: T }
          return parsed.value
        }
        // Not found in Redis — fall through to the memory store, which may
        // hold entries written while Redis was down.
      } catch (err) {
        logRedisErrorOnce(err)
      }
    }

    const entry = this.cache.get(key)
    if (!entry) {
      this.misses++
      return null
    }
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key)
      this.misses++
      return null
    }
    this.hits++
    return entry.value as T
  }

  async set<T>(key: string, value: T, ttl: number = this.defaultTTL, metadata?: any): Promise<void> {
    const redis = getRedisClient()
    if (redis) {
      try {
        await redis.set(
          KEY_PREFIX + key,
          JSON.stringify({ value, metadata }),
          'EX',
          Math.max(1, Math.floor(ttl))
        )
        return
      } catch (err) {
        logRedisErrorOnce(err)
        // fall through to memory
      }
    }

    this.cleanup()
    const entry: CacheEntry = {
      key,
      value,
      expiresAt: new Date(Date.now() + ttl * 1000),
      metadata,
    }
    this.cache.set(key, entry)
  }

  async has(key: string): Promise<boolean> {
    const redis = getRedisClient()
    if (redis) {
      try {
        if ((await redis.exists(KEY_PREFIX + key)) === 1) return true
      } catch (err) {
        logRedisErrorOnce(err)
      }
    }

    const entry = this.cache.get(key)
    if (!entry) return false
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  async delete(key: string): Promise<boolean> {
    let deleted = false
    const redis = getRedisClient()
    if (redis) {
      try {
        deleted = (await redis.del(KEY_PREFIX + key)) > 0
      } catch (err) {
        logRedisErrorOnce(err)
      }
    }
    return this.cache.delete(key) || deleted
  }

  async clear(): Promise<void> {
    const redis = getRedisClient()
    if (redis) {
      try {
        // Scan-and-delete only our namespace — never FLUSHDB on a shared Redis.
        let cursor = '0'
        do {
          const [next, keys] = await redis.scan(cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 100)
          cursor = next
          if (keys.length > 0) await redis.del(...keys)
        } while (cursor !== '0')
      } catch (err) {
        logRedisErrorOnce(err)
      }
    }
    this.cache.clear()
  }

  /** Opportunistic expiry sweep for the in-memory fallback store. */
  private cleanup(): void {
    const now = new Date()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
      }
    }
  }

  getStats() {
    const now = new Date()
    let validEntries = 0
    let expiredEntries = 0
    let totalTokensSaved = 0

    for (const entry of this.cache.values()) {
      if (entry.expiresAt < now) {
        expiredEntries++
      } else {
        validEntries++
        if (entry.metadata?.tokensSaved) {
          totalTokensSaved += entry.metadata.tokensSaved
        }
      }
    }

    const lookups = this.hits + this.misses
    return {
      backend: process.env.REDIS_URL ? ('redis' as const) : ('memory' as const),
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      totalTokensSaved,
      hits: this.hits,
      misses: this.misses,
      hitRate: lookups > 0 ? this.hits / lookups : 0,
    }
  }
}
