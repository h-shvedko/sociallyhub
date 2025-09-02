import { Ratelimit } from 'ratelimiter'

// In-memory rate limiter for development
// In production, you would use Redis with the Ratelimiter package
const cache = new Map()

// Simple in-memory implementation
export const ratelimit = {
  async limit(identifier: string) {
    const key = `ratelimit:${identifier}`
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window
    const maxRequests = 10 // 10 requests per minute

    // Get or create rate limit data for this identifier
    let data = cache.get(key) || { requests: [], windowStart: now }
    
    // Remove requests outside the current window
    data.requests = data.requests.filter((timestamp: number) => 
      now - timestamp < windowMs
    )
    
    // Check if limit exceeded
    if (data.requests.length >= maxRequests) {
      return { success: false, remaining: 0 }
    }
    
    // Add current request
    data.requests.push(now)
    cache.set(key, data)
    
    return { 
      success: true, 
      remaining: maxRequests - data.requests.length 
    }
  }
}

// Alternative Redis-based implementation (commented out)
/*
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
})
*/