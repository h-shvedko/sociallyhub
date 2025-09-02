import Redis from 'ioredis'
import { PrismaClient } from '@prisma/client'

// Cache configuration
export interface CacheConfig {
  ttl: number // Time to live in seconds
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  revalidate?: boolean
}

// Cache strategies
export enum CacheStrategy {
  CACHE_FIRST = 'cache-first',
  NETWORK_FIRST = 'network-first',
  STALE_WHILE_REVALIDATE = 'stale-while-revalidate',
  CACHE_ONLY = 'cache-only',
  NETWORK_ONLY = 'network-only'
}

// Cache key patterns
export const CACHE_KEYS = {
  USER: (id: string) => `user:${id}`,
  USER_WORKSPACES: (userId: string) => `user:${userId}:workspaces`,
  WORKSPACE: (id: string) => `workspace:${id}`,
  WORKSPACE_POSTS: (workspaceId: string) => `workspace:${workspaceId}:posts`,
  WORKSPACE_MEMBERS: (workspaceId: string) => `workspace:${workspaceId}:members`,
  POST: (id: string) => `post:${id}`,
  POST_ANALYTICS: (id: string) => `post:${id}:analytics`,
  ANALYTICS_DASHBOARD: (workspaceId: string, period: string) => `analytics:${workspaceId}:${period}`,
  SOCIAL_ACCOUNTS: (workspaceId: string) => `social-accounts:${workspaceId}`,
  NOTIFICATIONS: (userId: string) => `notifications:${userId}`,
  SESSION: (token: string) => `session:${token}`,
  RATE_LIMIT: (identifier: string) => `rate-limit:${identifier}`,
  METRICS: (type: string, period: string) => `metrics:${type}:${period}`
}

// Cache TTL configurations (in seconds)
export const CACHE_TTL = {
  USER_DATA: 300, // 5 minutes
  WORKSPACE_DATA: 600, // 10 minutes
  POST_DATA: 180, // 3 minutes
  ANALYTICS_DATA: 900, // 15 minutes
  SOCIAL_ACCOUNTS: 1800, // 30 minutes
  NOTIFICATIONS: 60, // 1 minute
  SESSION_DATA: 86400, // 24 hours
  METRICS_DATA: 3600, // 1 hour
  STATIC_DATA: 2592000, // 30 days
  SHORT_TERM: 60, // 1 minute
  MEDIUM_TERM: 300, // 5 minutes
  LONG_TERM: 3600 // 1 hour
}

class CacheManager {
  private redis: Redis | null = null
  private prisma: PrismaClient
  private memoryCache: Map<string, { data: any; expires: number; tags: string[] }> = new Map()

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.initRedis()
  }

  private async initRedis() {
    try {
      this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      })

      this.redis.on('error', (err) => {
        console.warn('Redis connection error:', err.message)
        this.redis = null
      })

      this.redis.on('connect', () => {
        console.log('Redis connected successfully')
      })

      await this.redis.connect()
    } catch (error) {
      console.warn('Failed to connect to Redis:', error)
      this.redis = null
    }
  }

  // Get cached data with fallback strategies
  async get<T>(
    key: string,
    fallback?: () => Promise<T>,
    config: Partial<CacheConfig> = {}
  ): Promise<T | null> {
    try {
      // Try Redis first
      if (this.redis) {
        const cached = await this.redis.get(key)
        if (cached) {
          return JSON.parse(cached)
        }
      }

      // Fallback to memory cache
      const memoryCached = this.memoryCache.get(key)
      if (memoryCached && memoryCached.expires > Date.now()) {
        return memoryCached.data
      }

      // Execute fallback function if provided
      if (fallback) {
        const data = await fallback()
        if (data !== null) {
          await this.set(key, data, config)
        }
        return data
      }

      return null
    } catch (error) {
      console.error('Cache get error:', error)
      return fallback ? await fallback() : null
    }
  }

  // Set cached data
  async set(
    key: string,
    data: any,
    config: Partial<CacheConfig> = {}
  ): Promise<void> {
    const { ttl = CACHE_TTL.MEDIUM_TERM, tags = [], priority = 'medium' } = config
    
    try {
      const serialized = JSON.stringify(data)
      const expires = Date.now() + (ttl * 1000)

      // Set in Redis
      if (this.redis) {
        await this.redis.setex(key, ttl, serialized)
        
        // Add tags for cache invalidation
        if (tags.length > 0) {
          for (const tag of tags) {
            await this.redis.sadd(`tag:${tag}`, key)
            await this.redis.expire(`tag:${tag}`, ttl)
          }
        }
      }

      // Set in memory cache as fallback
      this.memoryCache.set(key, { data, expires, tags })

      // Clean up expired memory cache entries periodically
      if (Math.random() < 0.1) { // 10% chance
        this.cleanupMemoryCache()
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  // Delete cached data
  async delete(key: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(key)
      }
      this.memoryCache.delete(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  // Invalidate cache by tags
  async invalidateByTag(tag: string): Promise<void> {
    try {
      if (this.redis) {
        const keys = await this.redis.smembers(`tag:${tag}`)
        if (keys.length > 0) {
          await this.redis.del(...keys)
          await this.redis.del(`tag:${tag}`)
        }
      }

      // Invalidate memory cache
      for (const [key, value] of this.memoryCache.entries()) {
        if (value.tags.includes(tag)) {
          this.memoryCache.delete(key)
        }
      }
    } catch (error) {
      console.error('Cache invalidate by tag error:', error)
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.flushall()
      }
      this.memoryCache.clear()
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    redis: { connected: boolean; keys: number; memory: string } | null
    memory: { size: number; keys: number }
  }> {
    try {
      const stats = {
        redis: null as any,
        memory: {
          size: this.memoryCache.size,
          keys: this.memoryCache.size
        }
      }

      if (this.redis) {
        const info = await this.redis.info('memory')
        const dbSize = await this.redis.dbsize()
        const memoryMatch = info.match(/used_memory_human:(.+)/i)
        
        stats.redis = {
          connected: true,
          keys: dbSize,
          memory: memoryMatch ? memoryMatch[1].trim() : 'unknown'
        }
      }

      return stats
    } catch (error) {
      console.error('Cache stats error:', error)
      return {
        redis: null,
        memory: { size: 0, keys: 0 }
      }
    }
  }

  // Cached database query wrapper
  async cachedQuery<T>(
    key: string,
    query: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM_TERM,
    tags: string[] = []
  ): Promise<T> {
    return await this.get(key, query, { ttl, tags }) as T
  }

  // Stale while revalidate pattern
  async staleWhileRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM_TERM,
    staleTtl: number = ttl * 2
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key)
      
      if (cached !== null) {
        // Return cached data immediately
        // Revalidate in background
        setImmediate(async () => {
          try {
            const fresh = await fetcher()
            await this.set(key, fresh, { ttl })
          } catch (error) {
            console.error('Background revalidation failed:', error)
          }
        })
        
        return cached
      }

      // No cache, fetch fresh data
      const fresh = await fetcher()
      await this.set(key, fresh, { ttl })
      return fresh
    } catch (error) {
      console.error('Stale while revalidate error:', error)
      return await fetcher()
    }
  }

  // Clean up expired memory cache entries
  private cleanupMemoryCache(): void {
    const now = Date.now()
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        this.memoryCache.delete(key)
      }
    }
  }

  // Rate limiting using cache
  async rateLimit(
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = CACHE_KEYS.RATE_LIMIT(identifier)
    const now = Date.now()
    const resetTime = now + windowMs

    try {
      if (this.redis) {
        const current = await this.redis.incr(key)
        if (current === 1) {
          await this.redis.pexpire(key, windowMs)
        }

        return {
          allowed: current <= limit,
          remaining: Math.max(0, limit - current),
          resetTime
        }
      }

      // Fallback to memory cache
      const cached = this.memoryCache.get(key)
      const current = cached && cached.expires > now ? cached.data + 1 : 1
      
      this.memoryCache.set(key, {
        data: current,
        expires: resetTime,
        tags: []
      })

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime
      }
    } catch (error) {
      console.error('Rate limit error:', error)
      return { allowed: true, remaining: limit - 1, resetTime }
    }
  }

  // Distributed lock using Redis
  async acquireLock(
    key: string,
    ttl: number = 10000,
    maxRetries: number = 3
  ): Promise<string | null> {
    if (!this.redis) return null

    const lockKey = `lock:${key}`
    const lockValue = `${Date.now()}-${Math.random()}`

    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.redis.set(lockKey, lockValue, 'PX', ttl, 'NX')
        if (result === 'OK') {
          return lockValue
        }
      } catch (error) {
        console.error('Acquire lock error:', error)
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)))
    }

    return null
  }

  // Release distributed lock
  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    if (!this.redis) return false

    const lockKey = `lock:${key}`
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `

    try {
      const result = await this.redis.eval(luaScript, 1, lockKey, lockValue)
      return result === 1
    } catch (error) {
      console.error('Release lock error:', error)
      return false
    }
  }
}

// Global cache manager instance
let cacheManager: CacheManager | null = null

export function getCacheManager(prisma: PrismaClient): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager(prisma)
  }
  return cacheManager
}

export { CacheManager }
export default CacheManager