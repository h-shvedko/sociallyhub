import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppLogger } from '@/lib/logger'

export interface LoggingContext {
  method: string
  url: string
  startTime: number
  userId?: string
  userAgent?: string
  ip?: string
}

/**
 * Higher-order function to wrap API routes with logging
 */
export function withLogging<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  routeName?: string
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const startTime = Date.now()
    const method = request.method
    const url = new URL(request.url).pathname
    const userAgent = request.headers.get('user-agent') || 'Unknown'
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'Unknown'

    let userId: string | undefined
    let response: NextResponse

    try {
      // Try to get user session for logging context
      try {
        const session = await getServerSession(authOptions)
        userId = session?.user?.id
      } catch (error) {
        // Session retrieval failed, continue without userId
      }

      // Log the incoming request
      AppLogger.apiRequest(method, url, userId, {
        userAgent,
        ip,
        routeName,
        timestamp: new Date().toISOString()
      })

      // Execute the handler
      response = await handler(request, ...args)
      
      const duration = Date.now() - startTime
      const statusCode = response.status

      // Log the response
      AppLogger.apiResponse(method, url, statusCode, duration, userId, {
        userAgent,
        ip,
        routeName,
        timestamp: new Date().toISOString()
      })

      // Log slow requests (>1000ms)
      if (duration > 1000) {
        AppLogger.warn(`Slow API request detected: ${method} ${url} took ${duration}ms`, {
          type: 'slow_request',
          method,
          url,
          duration,
          userId,
          routeName
        })
      }

      return response

    } catch (error) {
      const duration = Date.now() - startTime
      
      // Log the error
      AppLogger.apiError(method, url, error as Error, userId, {
        userAgent,
        ip,
        routeName,
        duration,
        timestamp: new Date().toISOString()
      })

      // Return error response
      return NextResponse.json(
        { 
          error: 'Internal server error',
          timestamp: new Date().toISOString(),
          requestId: generateRequestId()
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware for logging database operations
 */
export class DatabaseLogger {
  static logQuery(query: string, params?: any, duration?: number) {
    AppLogger.dbQuery(query, duration || 0, { params })
  }

  static logError(query: string, error: Error, params?: any) {
    AppLogger.dbError(query, error, { params })
  }

  static logSlowQuery(query: string, duration: number, params?: any) {
    AppLogger.warn(`Slow database query detected: ${duration}ms`, {
      type: 'slow_query',
      query,
      duration,
      params
    })
  }
}

/**
 * Authentication event logger
 */
export class AuthLogger {
  static logSignIn(userId: string, email: string, provider?: string) {
    AppLogger.authSuccess(userId, 'sign_in', {
      email,
      provider,
      timestamp: new Date().toISOString()
    })
  }

  static logSignOut(userId: string, email: string) {
    AppLogger.authSuccess(userId, 'sign_out', {
      email,
      timestamp: new Date().toISOString()
    })
  }

  static logFailedSignIn(email: string, reason: string, ip?: string) {
    AppLogger.authFailure('sign_in', reason, {
      email,
      ip,
      timestamp: new Date().toISOString()
    })
  }

  static logPasswordChange(userId: string, email: string) {
    AppLogger.authSuccess(userId, 'password_change', {
      email,
      timestamp: new Date().toISOString()
    })
  }

  static logSuspiciousActivity(userId: string, activity: string, details?: any) {
    AppLogger.securityEvent(`Suspicious activity: ${activity}`, 'medium', {
      userId,
      activity,
      details,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Business logic logger
 */
export class BusinessLogger {
  static logPostCreated(postId: string, userId: string, data: any) {
    AppLogger.postCreated(postId, userId, data.platforms || [], {
      title: data.title,
      status: data.status,
      scheduledAt: data.scheduledAt,
      timestamp: new Date().toISOString()
    })
  }

  static logPostUpdated(postId: string, userId: string, changes: any) {
    AppLogger.info(`Post updated: ${postId}`, {
      type: 'post_updated',
      postId,
      userId,
      changes,
      timestamp: new Date().toISOString()
    })
  }

  static logPostDeleted(postId: string, userId: string) {
    AppLogger.info(`Post deleted: ${postId}`, {
      type: 'post_deleted',
      postId,
      userId,
      timestamp: new Date().toISOString()
    })
  }

  static logBulkOperation(operation: string, count: number, userId: string, details?: any) {
    AppLogger.bulkScheduled(count, userId, {
      operation,
      details,
      timestamp: new Date().toISOString()
    })
  }

  static logMediaUpload(assetId: string, userId: string, filename: string, size: number) {
    AppLogger.info(`Media uploaded: ${filename}`, {
      type: 'media_upload',
      assetId,
      userId,
      filename,
      size,
      timestamp: new Date().toISOString()
    })
  }

  static logWorkspaceAction(action: string, workspaceId: string, userId: string, details?: any) {
    AppLogger.info(`Workspace action: ${action}`, {
      type: 'workspace_action',
      action,
      workspaceId,
      userId,
      details,
      timestamp: new Date().toISOString()
    })
  }

  static logClientListViewed(userId: string, workspaceId: string, details?: any) {
    AppLogger.info(`Client list viewed`, {
      type: 'client_list_viewed',
      userId,
      workspaceId,
      details,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Generic system/lifecycle event (queues, workers, jobs, schedulers, etc.).
   *
   * NOTE (ADR-0008, added while wiring the worker entrypoint): ~58 call sites
   * across `src/lib/jobs/**` and the background processors already invoke
   * `BusinessLogger.logSystemEvent(event, data)`, but the method never existed —
   * a latent `TypeError` that only surfaces once the job/queue code actually
   * runs (it was dead in the web process). This additive definition unblocks the
   * worker; the signature matches every existing call site.
   */
  static logSystemEvent(event: string, data?: any) {
    AppLogger.info(`System event: ${event}`, {
      type: 'system_event',
      event,
      ...(data && typeof data === 'object' ? data : { data }),
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Notification lifecycle event. Same story as `logSystemEvent`: ~27 call sites
   * (notification services, dispatch processors, notification API routes) already
   * call `logNotificationEvent(event, userId, data)` against a method that did
   * not exist. Additive; signature matches existing usage.
   */
  static logNotificationEvent(event: string, userId: string, data?: any) {
    AppLogger.info(`Notification event: ${event}`, {
      type: 'notification_event',
      event,
      userId,
      ...(data && typeof data === 'object' ? data : { data }),
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Performance monitoring logger
 */
export class PerformanceLogger {
  private static performanceThresholds = {
    api: 1000,      // 1 second
    database: 500,  // 500ms
    external: 2000, // 2 seconds
  }

  static logPerformance(operation: string, duration: number, type: 'api' | 'database' | 'external' = 'api', details?: any) {
    AppLogger.performance(operation, duration, {
      type: `${type}_performance`,
      details,
      timestamp: new Date().toISOString()
    })

    // Log performance warnings
    const threshold = this.performanceThresholds[type]
    if (duration > threshold) {
      AppLogger.warn(`Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`, {
        type: 'performance_warning',
        operation,
        duration,
        threshold,
        category: type,
        details,
        timestamp: new Date().toISOString()
      })
    }
  }

  static startTimer(operation: string) {
    const startTime = Date.now()
    return {
      operation,
      startTime,
      end: (details?: any) => {
        const duration = Date.now() - startTime
        this.logPerformance(operation, duration, 'api', details)
        return duration
      },
      // Elapsed ms without emitting a performance log. Added with ADR-0008: the
      // job wrapper in `queue-manager.ts` (and the processors) already call
      // `timer.getDuration()` on the success path, but the method was never on
      // the returned object — a latent `TypeError` on every completed job.
      // Additive; nothing depended on its absence.
      getDuration: () => Date.now() - startTime
    }
  }
}

/**
 * Error categorization and logging
 */
export class ErrorLogger {
  static logValidationError(error: any, context?: any) {
    AppLogger.warn('Validation error', {
      type: 'validation_error',
      error: {
        message: error.message,
        details: error.details || error.issues,
      },
      context,
      timestamp: new Date().toISOString()
    })
  }

  static logDatabaseError(error: Error, query?: string, context?: any) {
    AppLogger.error('Database error', error, {
      type: 'database_error',
      query,
      context,
      timestamp: new Date().toISOString()
    })
  }

  static logExternalServiceError(service: string, error: Error, context?: any) {
    AppLogger.error(`External service error: ${service}`, error, {
      type: 'external_service_error',
      service,
      context,
      timestamp: new Date().toISOString()
    })
  }

  static logUnexpectedError(error: Error, context?: any) {
    AppLogger.error('Unexpected error', error, {
      type: 'unexpected_error',
      context,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Security event logger
 */
export class SecurityLogger {
  static logUnauthorizedAccess(userId: string | undefined, resource: string, ip?: string) {
    AppLogger.securityEvent('Unauthorized access attempt', 'medium', {
      userId,
      resource,
      ip,
      timestamp: new Date().toISOString()
    })
  }

  static logRateLimitExceeded(userId: string | undefined, endpoint: string, ip?: string) {
    AppLogger.securityEvent('Rate limit exceeded', 'low', {
      userId,
      endpoint,
      ip,
      timestamp: new Date().toISOString()
    })
  }

  static logSuspiciousRequest(reason: string, userId: string | undefined, details?: any) {
    AppLogger.securityEvent(`Suspicious request: ${reason}`, 'high', {
      userId,
      reason,
      details,
      timestamp: new Date().toISOString()
    })
  }
}

// Utility function to generate request IDs
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}