import { PrismaClient, Prisma } from '@prisma/client'
import { getCacheManager, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/cache-manager'

// Query performance monitoring
interface QueryStats {
  query: string
  duration: number
  timestamp: number
  cached: boolean
}

class QueryOptimizer {
  private prisma: PrismaClient
  private cacheManager: ReturnType<typeof getCacheManager>
  private queryStats: QueryStats[] = []
  private slowQueryThreshold = 1000 // 1 second

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.cacheManager = getCacheManager(prisma)
  }

  // Optimized user queries with caching and selective fields
  async getUserById(id: string, includeWorkspaces: boolean = false) {
    const cacheKey = CACHE_KEYS.USER(id)
    
    return this.cacheManager.cachedQuery(
      cacheKey,
      async () => {
        const startTime = performance.now()
        
        const user = await this.prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            createdAt: true,
            emailVerified: true,
            ...(includeWorkspaces && {
              userWorkspaces: {
                select: {
                  role: true,
                  workspace: {
                    select: {
                      id: true,
                      name: true,
                      description: true,
                      createdAt: true,
                      _count: {
                        select: {
                          posts: true,
                          members: true,
                          socialAccounts: true
                        }
                      }
                    }
                  }
                }
              }
            })
          }
        })

        this.recordQueryStats('getUserById', performance.now() - startTime, false)
        return user
      },
      CACHE_TTL.USER_DATA,
      ['user', `user-${id}`]
    )
  }

  // Optimized workspace queries with pagination
  async getWorkspaceWithPosts(
    workspaceId: string,
    userId: string,
    options: {
      page?: number
      limit?: number
      status?: string
      sortBy?: 'createdAt' | 'scheduledAt' | 'updatedAt'
      sortOrder?: 'asc' | 'desc'
    } = {}
  ) {
    const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = 'desc' } = options
    const offset = (page - 1) * limit

    // Check user permissions first (cached)
    const userPermission = await this.getUserWorkspaceRole(userId, workspaceId)
    if (!userPermission) {
      throw new Error('Access denied')
    }

    const cacheKey = `${CACHE_KEYS.WORKSPACE_POSTS(workspaceId)}:${JSON.stringify(options)}`
    
    return this.cacheManager.cachedQuery(
      cacheKey,
      async () => {
        const startTime = performance.now()

        const whereClause: Prisma.PostWhereInput = {
          workspaceId,
          ...(status && { status })
        }

        const [posts, totalCount] = await this.prisma.$transaction([
          this.prisma.post.findMany({
            where: whereClause,
            select: {
              id: true,
              content: true,
              status: true,
              scheduledAt: true,
              publishedAt: true,
              createdAt: true,
              updatedAt: true,
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              },
              platforms: {
                select: {
                  platform: true,
                  isActive: true,
                  accountId: true
                }
              },
              _count: {
                select: {
                  comments: true,
                  variants: true
                }
              }
            },
            orderBy: {
              [sortBy]: sortOrder
            },
            skip: offset,
            take: limit
          }),
          this.prisma.post.count({ where: whereClause })
        ])

        this.recordQueryStats('getWorkspaceWithPosts', performance.now() - startTime, false)

        return {
          posts,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          }
        }
      },
      CACHE_TTL.POST_DATA,
      ['workspace', 'posts', `workspace-${workspaceId}`]
    )
  }

  // Optimized analytics queries with aggregation
  async getWorkspaceAnalytics(
    workspaceId: string,
    period: { start: Date; end: Date },
    metrics: string[] = []
  ) {
    const cacheKey = CACHE_KEYS.ANALYTICS_DASHBOARD(workspaceId, `${period.start.toISOString()}-${period.end.toISOString()}`)
    
    return this.cacheManager.cachedQuery(
      cacheKey,
      async () => {
        const startTime = performance.now()

        // Use raw SQL for complex analytics queries
        const analyticsQuery = `
          SELECT 
            DATE_TRUNC('day', "createdAt") as date,
            COUNT(*) as posts_count,
            COUNT(CASE WHEN "status" = 'PUBLISHED' THEN 1 END) as published_count,
            COUNT(CASE WHEN "status" = 'SCHEDULED' THEN 1 END) as scheduled_count,
            AVG(CASE WHEN "status" = 'PUBLISHED' THEN 1 ELSE 0 END) as success_rate
          FROM "Post"
          WHERE "workspaceId" = $1 
            AND "createdAt" >= $2 
            AND "createdAt" <= $3
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY date DESC
        `

        const analyticsData = await this.prisma.$queryRaw<any[]>`${Prisma.raw(analyticsQuery)}` as any[]

        // Get aggregated metrics
        const totalPosts = await this.prisma.post.count({
          where: {
            workspaceId,
            createdAt: {
              gte: period.start,
              lte: period.end
            }
          }
        })

        const publishedPosts = await this.prisma.post.count({
          where: {
            workspaceId,
            status: 'PUBLISHED',
            createdAt: {
              gte: period.start,
              lte: period.end
            }
          }
        })

        // Get top performing posts
        const topPosts = await this.prisma.post.findMany({
          where: {
            workspaceId,
            status: 'PUBLISHED',
            createdAt: {
              gte: period.start,
              lte: period.end
            }
          },
          select: {
            id: true,
            content: true,
            publishedAt: true,
            analyticsMetrics: {
              select: {
                engagements: true,
                impressions: true,
                clicks: true
              },
              orderBy: {
                engagements: 'desc'
              },
              take: 1
            }
          },
          take: 10,
          orderBy: {
            analyticsMetrics: {
              _count: 'desc'
            }
          }
        })

        this.recordQueryStats('getWorkspaceAnalytics', performance.now() - startTime, false)

        return {
          overview: {
            totalPosts,
            publishedPosts,
            successRate: totalPosts > 0 ? (publishedPosts / totalPosts) * 100 : 0,
            period
          },
          timeline: analyticsData,
          topPosts
        }
      },
      CACHE_TTL.ANALYTICS_DATA,
      ['analytics', `analytics-${workspaceId}`]
    )
  }

  // Optimized user workspace role check with caching
  async getUserWorkspaceRole(userId: string, workspaceId: string) {
    const cacheKey = `user-workspace-role:${userId}:${workspaceId}`
    
    return this.cacheManager.cachedQuery(
      cacheKey,
      async () => {
        const startTime = performance.now()
        
        const userWorkspace = await this.prisma.userWorkspace.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId
            }
          },
          select: {
            role: true,
            permissions: true,
            isActive: true
          }
        })

        this.recordQueryStats('getUserWorkspaceRole', performance.now() - startTime, false)
        return userWorkspace
      },
      CACHE_TTL.USER_DATA,
      ['user', 'workspace', `user-${userId}`, `workspace-${workspaceId}`]
    )
  }

  // Bulk operations with transactions
  async bulkUpdatePosts(
    postIds: string[],
    updates: Partial<Prisma.PostUpdateInput>,
    workspaceId: string
  ) {
    const startTime = performance.now()

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Verify all posts belong to the workspace
        const posts = await tx.post.findMany({
          where: {
            id: { in: postIds },
            workspaceId
          },
          select: { id: true }
        })

        if (posts.length !== postIds.length) {
          throw new Error('Some posts not found or access denied')
        }

        // Perform bulk update
        return await tx.post.updateMany({
          where: {
            id: { in: postIds },
            workspaceId
          },
          data: updates
        })
      })

      // Invalidate relevant caches
      await this.cacheManager.invalidateByTag(`workspace-${workspaceId}`)
      await this.cacheManager.invalidateByTag('posts')

      this.recordQueryStats('bulkUpdatePosts', performance.now() - startTime, false)
      return result
    } catch (error) {
      this.recordQueryStats('bulkUpdatePosts', performance.now() - startTime, false)
      throw error
    }
  }

  // Optimized search with full-text search
  async searchPosts(
    workspaceId: string,
    query: string,
    options: {
      limit?: number
      offset?: number
      filters?: {
        status?: string[]
        platforms?: string[]
        dateRange?: { start: Date; end: Date }
      }
    } = {}
  ) {
    const { limit = 20, offset = 0, filters = {} } = options
    const startTime = performance.now()

    try {
      // Use PostgreSQL full-text search for better performance
      const searchQuery = `
        SELECT 
          p.*,
          ts_rank(to_tsvector('english', p.content), plainto_tsquery('english', $1)) as rank
        FROM "Post" p
        WHERE p."workspaceId" = $2
          AND to_tsvector('english', p.content) @@ plainto_tsquery('english', $1)
          ${filters.status ? 'AND p.status = ANY($3)' : ''}
          ${filters.dateRange ? 'AND p."createdAt" >= $4 AND p."createdAt" <= $5' : ''}
        ORDER BY rank DESC, p."createdAt" DESC
        LIMIT $${filters.status ? '6' : '3'}
        OFFSET $${filters.status ? '7' : '4'}
      `

      const params = [query, workspaceId]
      if (filters.status) params.push(filters.status)
      if (filters.dateRange) {
        params.push(filters.dateRange.start, filters.dateRange.end)
      }
      params.push(limit, offset)

      const results = await this.prisma.$queryRawUnsafe(searchQuery, ...params) as any[]

      this.recordQueryStats('searchPosts', performance.now() - startTime, false)
      return results
    } catch (error) {
      // Fallback to regular LIKE search if full-text search fails
      const fallbackResults = await this.prisma.post.findMany({
        where: {
          workspaceId,
          content: {
            contains: query,
            mode: 'insensitive'
          },
          ...(filters.status && { status: { in: filters.status } }),
          ...(filters.dateRange && {
            createdAt: {
              gte: filters.dateRange.start,
              lte: filters.dateRange.end
            }
          })
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      })

      this.recordQueryStats('searchPosts (fallback)', performance.now() - startTime, false)
      return fallbackResults
    }
  }

  // Connection pooling optimization
  async optimizeConnections() {
    // Get connection pool stats
    const poolStats = await this.prisma.$queryRaw`
      SELECT 
        count(*) as active_connections,
        max(backend_start) as oldest_connection,
        current_setting('max_connections') as max_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    ` as any[]

    return poolStats[0]
  }

  // Query performance analysis
  getQueryStats() {
    const totalQueries = this.queryStats.length
    const slowQueries = this.queryStats.filter(q => q.duration > this.slowQueryThreshold)
    const averageDuration = totalQueries > 0 
      ? this.queryStats.reduce((sum, q) => sum + q.duration, 0) / totalQueries 
      : 0

    return {
      totalQueries,
      slowQueries: slowQueries.length,
      averageDuration: Math.round(averageDuration * 100) / 100,
      slowQueryThreshold: this.slowQueryThreshold,
      recentSlowQueries: slowQueries.slice(-10)
    }
  }

  // Clear query stats
  clearStats() {
    this.queryStats = []
  }

  // Record query performance
  private recordQueryStats(query: string, duration: number, cached: boolean) {
    this.queryStats.push({
      query,
      duration: Math.round(duration * 100) / 100,
      timestamp: Date.now(),
      cached
    })

    // Keep only recent stats (last 1000 queries)
    if (this.queryStats.length > 1000) {
      this.queryStats = this.queryStats.slice(-1000)
    }

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development' && duration > this.slowQueryThreshold) {
      console.warn(`[Slow Query] ${query}: ${Math.round(duration)}ms`)
    }
  }

  // Database health check
  async healthCheck() {
    const startTime = performance.now()
    
    try {
      await this.prisma.$queryRaw`SELECT 1`
      const duration = performance.now() - startTime
      
      return {
        status: 'healthy',
        latency: Math.round(duration * 100) / 100,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }
}

// Global query optimizer instance
let queryOptimizer: QueryOptimizer | null = null

export function getQueryOptimizer(prisma: PrismaClient): QueryOptimizer {
  if (!queryOptimizer) {
    queryOptimizer = new QueryOptimizer(prisma)
  }
  return queryOptimizer
}

// Prisma middleware for query logging and caching
export function createQueryMiddleware(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    const startTime = performance.now()
    
    try {
      const result = await next(params)
      const duration = performance.now() - startTime
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`[Slow Query] ${params.model}.${params.action}: ${Math.round(duration)}ms`)
      }
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`[Query Error] ${params.model}.${params.action}: ${Math.round(duration)}ms`, error)
      throw error
    }
  })
}

export { QueryOptimizer }
export default QueryOptimizer