import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

// Next.js App Router cache utilities

// Cache configuration for different data types
export const NEXT_CACHE_TAGS = {
  USER: 'user',
  WORKSPACE: 'workspace', 
  POST: 'post',
  ANALYTICS: 'analytics',
  SOCIAL_ACCOUNTS: 'social-accounts',
  NOTIFICATIONS: 'notifications',
  TEAM: 'team',
  SETTINGS: 'settings'
}

export const NEXT_CACHE_DURATION = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes 
  LONG: 900, // 15 minutes
  HOUR: 3600, // 1 hour
  DAY: 86400 // 24 hours
}

// Cached function wrapper with tags
export function createCachedFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  tags: string[],
  revalidate: number = NEXT_CACHE_DURATION.MEDIUM
): T {
  return unstable_cache(fn, undefined, {
    tags,
    revalidate
  }) as T
}

// API route cache wrapper
export function withCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    tags?: string[]
    revalidate?: number
    vary?: string[]
  } = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { tags = [], revalidate = NEXT_CACHE_DURATION.MEDIUM, vary = [] } = options
    
    try {
      const response = await handler(req)
      
      // Add cache headers
      const headers = new Headers(response.headers)
      
      // Set cache control
      headers.set('Cache-Control', `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}`)
      
      // Add ETag for conditional requests
      const etag = generateETag(await response.clone().text())
      headers.set('ETag', etag)
      
      // Handle conditional requests
      const ifNoneMatch = req.headers.get('If-None-Match')
      if (ifNoneMatch === etag) {
        return new NextResponse(null, { status: 304, headers })
      }
      
      // Add Vary headers
      if (vary.length > 0) {
        headers.set('Vary', vary.join(', '))
      }
      
      return new NextResponse(response.body, {
        status: response.status,
        headers
      })
    } catch (error) {
      console.error('Cache wrapper error:', error)
      return await handler(req)
    }
  }
}

// Page cache wrapper for static generation
export function withPageCache<T extends Record<string, any>>(
  generateStaticParams: () => Promise<T[]>,
  tags: string[],
  revalidate: number = NEXT_CACHE_DURATION.HOUR
) {
  return createCachedFunction(generateStaticParams, tags, revalidate)
}

// Cache revalidation utilities
export class CacheRevalidator {
  // Revalidate by tags
  static async revalidateByTags(tags: string[]): Promise<void> {
    try {
      await Promise.all(tags.map(tag => revalidateTag(tag)))
    } catch (error) {
      console.error('Cache revalidation by tags failed:', error)
    }
  }

  // Revalidate by paths
  static async revalidateByPaths(paths: string[]): Promise<void> {
    try {
      await Promise.all(paths.map(path => revalidatePath(path)))
    } catch (error) {
      console.error('Cache revalidation by paths failed:', error)
    }
  }

  // Revalidate user-related cache
  static async revalidateUser(userId: string): Promise<void> {
    await this.revalidateByTags([
      `${NEXT_CACHE_TAGS.USER}-${userId}`,
      NEXT_CACHE_TAGS.NOTIFICATIONS,
      NEXT_CACHE_TAGS.TEAM
    ])
  }

  // Revalidate workspace-related cache  
  static async revalidateWorkspace(workspaceId: string): Promise<void> {
    await this.revalidateByTags([
      `${NEXT_CACHE_TAGS.WORKSPACE}-${workspaceId}`,
      NEXT_CACHE_TAGS.POST,
      NEXT_CACHE_TAGS.ANALYTICS,
      NEXT_CACHE_TAGS.TEAM
    ])
  }

  // Revalidate post-related cache
  static async revalidatePost(postId: string, workspaceId: string): Promise<void> {
    await this.revalidateByTags([
      `${NEXT_CACHE_TAGS.POST}-${postId}`,
      `${NEXT_CACHE_TAGS.WORKSPACE}-${workspaceId}`,
      NEXT_CACHE_TAGS.ANALYTICS
    ])
  }

  // Revalidate analytics cache
  static async revalidateAnalytics(workspaceId: string): Promise<void> {
    await this.revalidateByTags([
      `${NEXT_CACHE_TAGS.ANALYTICS}-${workspaceId}`,
      NEXT_CACHE_TAGS.ANALYTICS
    ])
  }
}

// Request deduplication for parallel requests
class RequestDeduplicator {
  private static pendingRequests = new Map<string, Promise<any>>()

  static async deduplicate<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    // Check if request is already pending
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!
    }

    // Execute the request
    const promise = fetcher().finally(() => {
      // Clean up after request completes
      this.pendingRequests.delete(key)
    })

    // Store the pending request
    this.pendingRequests.set(key, promise)

    return promise
  }

  static clear(): void {
    this.pendingRequests.clear()
  }
}

// Generate ETag for responses
function generateETag(content: string): string {
  const crypto = require('crypto')
  return `"${crypto.createHash('md5').update(content).digest('hex')}"`
}

// Cache middleware for API routes
export function createCacheMiddleware(defaultRevalidate: number = NEXT_CACHE_DURATION.MEDIUM) {
  return {
    // GET request cache
    cached: <T>(
      fetcher: () => Promise<T>,
      key: string,
      tags: string[] = [],
      revalidate: number = defaultRevalidate
    ): Promise<T> => {
      return createCachedFunction(
        async () => fetcher(),
        tags.length > 0 ? tags : [key],
        revalidate
      )()
    },

    // Deduplicated request
    deduplicated: <T>(
      fetcher: () => Promise<T>,
      key: string
    ): Promise<T> => {
      return RequestDeduplicator.deduplicate(key, fetcher)
    },

    // Conditional cache based on request headers
    conditional: async <T>(
      req: NextRequest,
      fetcher: () => Promise<T>,
      generateETag: (data: T) => string
    ): Promise<{ data: T; notModified: boolean }> => {
      const data = await fetcher()
      const etag = generateETag(data)
      const ifNoneMatch = req.headers.get('If-None-Match')

      return {
        data,
        notModified: ifNoneMatch === etag
      }
    }
  }
}

// Static generation helpers
export const staticGeneration = {
  // Generate static params with cache
  params: withPageCache,

  // Force static generation for specific routes
  forceStatic: <T extends Record<string, any>>(
    params: T[],
    revalidate: number = NEXT_CACHE_DURATION.HOUR
  ) => ({
    generateStaticParams: async () => params,
    revalidate
  }),

  // Dynamic static generation with ISR
  dynamic: (revalidate: number = NEXT_CACHE_DURATION.HOUR) => ({
    revalidate,
    dynamicParams: true
  })
}

// Cache debugging utilities
export const cacheDebug = {
  // Log cache hit/miss
  logCacheStatus: (key: string, hit: boolean) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache] ${key}: ${hit ? 'HIT' : 'MISS'}`)
    }
  },

  // Cache performance monitoring
  measureCachePerformance: async <T>(
    operation: () => Promise<T>,
    label: string
  ): Promise<T> => {
    const start = performance.now()
    const result = await operation()
    const duration = performance.now() - start
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache Performance] ${label}: ${duration.toFixed(2)}ms`)
    }
    
    return result
  }
}

export {
  RequestDeduplicator,
  generateETag,
  createCacheMiddleware
}

export default {
  NEXT_CACHE_TAGS,
  NEXT_CACHE_DURATION,
  createCachedFunction,
  withCache,
  withPageCache,
  CacheRevalidator,
  RequestDeduplicator,
  createCacheMiddleware,
  staticGeneration,
  cacheDebug
}