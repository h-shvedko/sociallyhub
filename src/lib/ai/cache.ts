// AI Response Cache System

import { createHash } from 'crypto'
import { CacheEntry } from './types'

export class AICache {
  private cache = new Map<string, CacheEntry>()
  private readonly defaultTTL: number

  constructor(defaultTTL: number = 3600) { // 1 hour default
    this.defaultTTL = defaultTTL
    
    // Clean expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  generateKey(method: string, params: any): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort())
    return createHash('md5').update(`${method}:${paramsStr}`).digest('hex')
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  async set<T>(key: string, value: T, ttl: number = this.defaultTTL, metadata?: any): Promise<void> {
    const expiresAt = new Date(Date.now() + ttl * 1000)
    
    const entry: CacheEntry = {
      key,
      value,
      expiresAt,
      metadata
    }

    this.cache.set(key, entry)
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return false
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  private cleanup(): void {
    const now = new Date()
    const expiredKeys: string[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key)
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

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      totalTokensSaved,
      hitRate: 0 // Would need to track hits/misses for accurate rate
    }
  }
}