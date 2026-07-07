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

// Base logger-level format: a timestamp only. Colorization lives in the dev
// Console transport (below), NOT here — keeping colorize out of the base format
// means the JSON transports (stdout for Loki in container mode, or the dev log
// files) emit clean, ANSI-free `level`/`message` fields that Loki label
// extraction can parse. (This base format is composed under each transport's
// own format, which rebuilds the final line, so console appearance is
// unaffected.)
const format = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' })

// ADR-0023: in containers (LOG_TO_STDOUT=true, the default in prod compose) log
// JSON to stdout ONLY, so Promtail/Loki can scrape the Docker json logs. Writing
// files into the container's writable layer is invisible to Loki and pollutes a
// mostly-read-only standalone image, so file transports and file-based
// exception/rejection handlers are DROPPED in that mode. Local dev
// (LOG_TO_STDOUT unset/false) keeps the original file-transport behavior.
const logToStdout = process.env.LOG_TO_STDOUT === 'true'

// Structured JSON with a timestamp — the wire format for stdout and files.
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
)

// Human-friendly colorized line for a developer's terminal.
const consoleDevFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple()
)

// Define transports (conditional on the logging mode).
const transports: winston.transport[] = logToStdout
  ? [
      // Single JSON-to-stdout transport; Docker captures it, Promtail ships it.
      new winston.transports.Console({ format: jsonFormat }),
    ]
  : [
      // Console transport for development
      new winston.transports.Console({ format: consoleDevFormat }),

      // File transport for errors
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'error.log'),
        level: 'error',
        format: jsonFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),

      // File transport for all logs
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'combined.log'),
        format: jsonFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),

      // HTTP requests log
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'http.log'),
        level: 'http',
        format: jsonFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ]

// Uncaught exceptions / unhandled rejections: to stdout (JSON) in container
// mode; to files in local-dev mode.
const exceptionHandlers: winston.transport[] = logToStdout
  ? [new winston.transports.Console({ format: jsonFormat })]
  : [
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
        format: jsonFormat,
      }),
    ]

const rejectionHandlers: winston.transport[] = logToStdout
  ? [new winston.transports.Console({ format: jsonFormat })]
  : [
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'rejections.log'),
        format: jsonFormat,
      }),
    ]

// Create the logger
const Logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers,
  rejectionHandlers,
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