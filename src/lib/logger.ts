import winston from 'winston'
import path from 'path'

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow', 
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(colors)

// Custom format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  ),
)

// Define transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // HTTP requests log
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'http.log'),
    level: 'http',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
]

// Create the logger
const Logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
})

// Custom logging methods with context
export class AppLogger {
  static info(message: string, meta?: any) {
    Logger.info(message, { ...meta, service: 'sociallyhub' })
  }

  static error(message: string, error?: Error, meta?: any) {
    Logger.error(message, {
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      ...meta,
      service: 'sociallyhub'
    })
  }

  static warn(message: string, meta?: any) {
    Logger.warn(message, { ...meta, service: 'sociallyhub' })
  }

  static debug(message: string, meta?: any) {
    Logger.debug(message, { ...meta, service: 'sociallyhub' })
  }

  static http(message: string, meta?: any) {
    Logger.http(message, { ...meta, service: 'sociallyhub' })
  }

  // API-specific logging methods
  static apiRequest(method: string, url: string, userId?: string, meta?: any) {
    this.http(`${method} ${url}`, {
      type: 'api_request',
      method,
      url,
      userId,
      ...meta
    })
  }

  static apiResponse(method: string, url: string, statusCode: number, duration: number, userId?: string, meta?: any) {
    this.http(`${method} ${url} ${statusCode} - ${duration}ms`, {
      type: 'api_response',
      method,
      url,
      statusCode,
      duration,
      userId,
      ...meta
    })
  }

  static apiError(method: string, url: string, error: Error, userId?: string, meta?: any) {
    this.error(`API Error: ${method} ${url}`, error, {
      type: 'api_error',
      method,
      url,
      userId,
      ...meta
    })
  }

  // Database logging methods
  static dbQuery(query: string, duration: number, meta?: any) {
    this.debug(`DB Query: ${query} (${duration}ms)`, {
      type: 'db_query',
      query,
      duration,
      ...meta
    })
  }

  static dbError(query: string, error: Error, meta?: any) {
    this.error(`DB Error: ${query}`, error, {
      type: 'db_error',
      query,
      ...meta
    })
  }

  // Authentication logging methods
  static authSuccess(userId: string, action: string, meta?: any) {
    this.info(`Auth Success: ${action} for user ${userId}`, {
      type: 'auth_success',
      userId,
      action,
      ...meta
    })
  }

  static authFailure(action: string, reason: string, meta?: any) {
    this.warn(`Auth Failure: ${action} - ${reason}`, {
      type: 'auth_failure',
      action,
      reason,
      ...meta
    })
  }

  // Business logic logging methods
  static postCreated(postId: string, userId: string, platforms: string[], meta?: any) {
    this.info(`Post created: ${postId}`, {
      type: 'post_created',
      postId,
      userId,
      platforms,
      ...meta
    })
  }

  static postScheduled(postId: string, scheduledAt: string, userId: string, meta?: any) {
    this.info(`Post scheduled: ${postId} for ${scheduledAt}`, {
      type: 'post_scheduled',
      postId,
      scheduledAt,
      userId,
      ...meta
    })
  }

  static postPublished(postId: string, platform: string, userId: string, meta?: any) {
    this.info(`Post published: ${postId} on ${platform}`, {
      type: 'post_published',
      postId,
      platform,
      userId,
      ...meta
    })
  }

  static bulkScheduled(count: number, userId: string, meta?: any) {
    this.info(`Bulk scheduled: ${count} posts`, {
      type: 'bulk_scheduled',
      count,
      userId,
      ...meta
    })
  }

  // Performance logging
  static performance(operation: string, duration: number, meta?: any) {
    this.debug(`Performance: ${operation} took ${duration}ms`, {
      type: 'performance',
      operation,
      duration,
      ...meta
    })
  }

  // Security logging
  static securityEvent(event: string, severity: 'low' | 'medium' | 'high', meta?: any) {
    const logMethod = severity === 'high' ? this.error : severity === 'medium' ? this.warn : this.info
    logMethod(`Security Event: ${event}`, {
      type: 'security_event',
      event,
      severity,
      ...meta
    })
  }
}

export default Logger