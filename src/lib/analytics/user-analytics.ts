import { AppLogger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * User Analytics Service
 * Tracks user behavior, engagement metrics, and usage patterns
 */

export interface UserSession {
  userId: string
  sessionId: string
  startTime: Date
  lastActivity: Date
  userAgent?: string
  ip?: string
  pages: string[]
  actions: UserAction[]
}

export interface UserAction {
  type: string
  timestamp: Date
  details: any
  duration?: number
}

export interface AnalyticsMetric {
  userId: string
  metricType: string
  value: number
  date: Date
  metadata?: any
}

export class UserAnalytics {
  private static sessions = new Map<string, UserSession>()

  /**
   * Start a new user session
   */
  static startSession(userId: string, sessionId: string, context?: any) {
    const session: UserSession = {
      userId,
      sessionId,
      startTime: new Date(),
      lastActivity: new Date(),
      userAgent: context?.userAgent,
      ip: context?.ip,
      pages: [],
      actions: []
    }

    this.sessions.set(sessionId, session)

    AppLogger.info('User session started', {
      type: 'session_start',
      userId,
      sessionId,
      userAgent: context?.userAgent,
      ip: context?.ip,
      timestamp: new Date().toISOString()
    })

    // Store session in database for persistence
    this.persistSession(session)
  }

  /**
   * Update session activity
   */
  static updateActivity(sessionId: string, page?: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.lastActivity = new Date()
    
    if (page && !session.pages.includes(page)) {
      session.pages.push(page)
      
      AppLogger.info('Page view tracked', {
        type: 'page_view',
        userId: session.userId,
        sessionId,
        page,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Track user action
   */
  static trackAction(sessionId: string, actionType: string, details?: any, duration?: number) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const action: UserAction = {
      type: actionType,
      timestamp: new Date(),
      details,
      duration
    }

    session.actions.push(action)
    session.lastActivity = new Date()

    AppLogger.info('User action tracked', {
      type: 'user_action',
      userId: session.userId,
      sessionId,
      actionType,
      details,
      duration,
      timestamp: new Date().toISOString()
    })

    // Store action in database
    this.persistAction(session.userId, action)
  }

  /**
   * End user session
   */
  static endSession(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const duration = Date.now() - session.startTime.getTime()
    
    AppLogger.info('User session ended', {
      type: 'session_end',
      userId: session.userId,
      sessionId,
      duration,
      pagesViewed: session.pages.length,
      actionsPerformed: session.actions.length,
      timestamp: new Date().toISOString()
    })

    // Update session in database
    this.updateSessionEnd(sessionId, duration)
    
    this.sessions.delete(sessionId)
  }

  /**
   * Track feature usage
   */
  static trackFeatureUsage(userId: string, feature: string, details?: any) {
    AppLogger.info('Feature usage tracked', {
      type: 'feature_usage',
      userId,
      feature,
      details,
      timestamp: new Date().toISOString()
    })

    this.recordMetric(userId, 'feature_usage', 1, { feature, details })
  }

  /**
   * Track user engagement
   */
  static trackEngagement(userId: string, engagementType: string, value: number, details?: any) {
    AppLogger.info('User engagement tracked', {
      type: 'user_engagement',
      userId,
      engagementType,
      value,
      details,
      timestamp: new Date().toISOString()
    })

    this.recordMetric(userId, engagementType, value, details)
  }

  /**
   * Track conversion events
   */
  static trackConversion(userId: string, conversionType: string, value?: number, details?: any) {
    AppLogger.info('Conversion tracked', {
      type: 'conversion',
      userId,
      conversionType,
      value,
      details,
      timestamp: new Date().toISOString()
    })

    this.recordMetric(userId, `conversion_${conversionType}`, value || 1, details)
  }

  /**
   * Get user analytics data
   */
  static async getUserAnalytics(userId: string, dateRange?: { start: Date; end: Date }) {
    try {
      const where: any = { userId }
      if (dateRange) {
        where.date = {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }

      const metrics = await prisma.analyticsMetric.findMany({
        where,
        orderBy: { date: 'desc' },
        take: 1000
      })

      // Aggregate metrics by type
      const aggregated = metrics.reduce((acc: any, metric) => {
        if (!acc[metric.metricType]) {
          acc[metric.metricType] = {
            total: 0,
            count: 0,
            average: 0,
            latest: metric.date
          }
        }
        
        acc[metric.metricType].total += metric.value
        acc[metric.metricType].count += 1
        acc[metric.metricType].average = acc[metric.metricType].total / acc[metric.metricType].count
        
        if (metric.date > acc[metric.metricType].latest) {
          acc[metric.metricType].latest = metric.date
        }
        
        return acc
      }, {})

      return {
        userId,
        dateRange,
        metrics: aggregated,
        rawMetrics: metrics
      }
    } catch (error) {
      AppLogger.error('Failed to get user analytics', error as Error, {
        userId,
        dateRange
      })
      throw error
    }
  }

  /**
   * Get platform-wide analytics
   */
  static async getPlatformAnalytics(dateRange?: { start: Date; end: Date }) {
    try {
      const where: any = {}
      if (dateRange) {
        where.date = {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }

      const metrics = await prisma.analyticsMetric.findMany({
        where,
        orderBy: { date: 'desc' }
      })

      // Aggregate by metric type and date
      const aggregated = metrics.reduce((acc: any, metric) => {
        const dateKey = metric.date.toISOString().split('T')[0]
        
        if (!acc[dateKey]) {
          acc[dateKey] = {}
        }
        
        if (!acc[dateKey][metric.metricType]) {
          acc[dateKey][metric.metricType] = {
            total: 0,
            count: 0,
            uniqueUsers: new Set()
          }
        }
        
        acc[dateKey][metric.metricType].total += metric.value
        acc[dateKey][metric.metricType].count += 1
        acc[dateKey][metric.metricType].uniqueUsers.add(metric.userId)
        
        return acc
      }, {})

      // Convert sets to counts
      Object.keys(aggregated).forEach(date => {
        Object.keys(aggregated[date]).forEach(metricType => {
          aggregated[date][metricType].uniqueUsers = aggregated[date][metricType].uniqueUsers.size
        })
      })

      return {
        dateRange,
        dailyMetrics: aggregated,
        totalUsers: new Set(metrics.map(m => m.userId)).size,
        totalEvents: metrics.length
      }
    } catch (error) {
      AppLogger.error('Failed to get platform analytics', error as Error, {
        dateRange
      })
      throw error
    }
  }

  /**
   * Persist session to database
   */
  private static async persistSession(session: UserSession) {
    try {
      await prisma.userSession.create({
        data: {
          id: session.sessionId,
          userId: session.userId,
          startTime: session.startTime,
          lastActivity: session.lastActivity,
          userAgent: session.userAgent,
          ip: session.ip,
          pages: session.pages,
          metadata: {
            actions: session.actions.length
          }
        }
      })
    } catch (error) {
      AppLogger.error('Failed to persist session', error as Error, {
        sessionId: session.sessionId,
        userId: session.userId
      })
    }
  }

  /**
   * Update session end in database
   */
  private static async updateSessionEnd(sessionId: string, duration: number) {
    try {
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          endTime: new Date(),
          duration,
          updatedAt: new Date()
        }
      })
    } catch (error) {
      AppLogger.error('Failed to update session end', error as Error, {
        sessionId,
        duration
      })
    }
  }

  /**
   * Persist user action to database
   */
  private static async persistAction(userId: string, action: UserAction) {
    try {
      await prisma.userAction.create({
        data: {
          userId,
          actionType: action.type,
          timestamp: action.timestamp,
          details: action.details || {},
          duration: action.duration
        }
      })
    } catch (error) {
      AppLogger.error('Failed to persist user action', error as Error, {
        userId,
        actionType: action.type
      })
    }
  }

  /**
   * Record analytics metric
   */
  private static async recordMetric(userId: string, metricType: string, value: number, metadata?: any) {
    try {
      await prisma.analyticsMetric.create({
        data: {
          userId,
          metricType,
          value,
          date: new Date(),
          metadata: metadata || {}
        }
      })
    } catch (error) {
      AppLogger.error('Failed to record analytics metric', error as Error, {
        userId,
        metricType,
        value
      })
    }
  }

  /**
   * Clean up old sessions
   */
  static cleanupSessions() {
    const now = Date.now()
    const sessionsToRemove: string[] = []

    this.sessions.forEach((session, sessionId) => {
      // Remove sessions inactive for more than 30 minutes
      if (now - session.lastActivity.getTime() > 30 * 60 * 1000) {
        sessionsToRemove.push(sessionId)
      }
    })

    sessionsToRemove.forEach(sessionId => {
      this.endSession(sessionId)
    })

    AppLogger.debug(`Cleaned up ${sessionsToRemove.length} inactive sessions`)
  }
}

// Schedule session cleanup every 15 minutes
setInterval(() => {
  UserAnalytics.cleanupSessions()
}, 15 * 60 * 1000)