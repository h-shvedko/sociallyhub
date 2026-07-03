import { Queue, Worker, Job, QueueEvents, JobsOptions, ConnectionOptions } from 'bullmq'
import Redis, { RedisOptions } from 'ioredis'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'

/**
 * Build ioredis connection options for BullMQ.
 *
 * Prefers REDIS_URL (parsed) so the same value works in dev compose
 * (redis://redis:6379) and on the host (redis://localhost:6379); falls back to
 * discrete REDIS_HOST/REDIS_PORT for the prod compose stack. `maxRetriesPerRequest`
 * is set to null by the caller (ADR-0008) — a BullMQ v5 requirement for Workers.
 */
export function buildRedisConnectionOptions(): RedisOptions {
  const url = process.env.REDIS_URL
  if (url) {
    const parsed = new URL(url)
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: parsed.pathname && parsed.pathname.length > 1
        ? parseInt(parsed.pathname.slice(1), 10)
        : 0,
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  }
}

/** Separator for the composite (queueName, jobName) processor registry key. */
const PROCESSOR_KEY_SEP = '::'

export interface JobQueueConfig {
  redis: {
    host: string
    port: number
    password?: string
    db?: number
  }
  defaultJobOptions: JobsOptions
  concurrency: {
    [queueName: string]: number
  }
}

export interface JobData {
  id: string
  type: string
  payload: any
  userId?: string
  workspaceId?: string
  createdAt: string
  scheduledFor?: string
  retryCount?: number
  priority?: number
}

export interface JobResult {
  success: boolean
  result?: any
  error?: string
  metrics?: {
    duration: number
    memoryUsage: number
    timestamp: string
  }
}

export type JobProcessor<T = any> = (job: Job<T>, token?: string) => Promise<JobResult>

export class QueueManager {
  private redis: Redis
  // BullMQ connection *options* (not a shared client). Each Queue/Worker/QueueEvents
  // creates its own connection from these — required so Workers get their own
  // connection with maxRetriesPerRequest:null (BullMQ v5). See ADR-0008.
  private connectionOptions: ConnectionOptions
  private queues: Map<string, Queue> = new Map()
  private workers: Map<string, Worker> = new Map()
  private queueEvents: Map<string, QueueEvents> = new Map()
  // Keyed by `${queueName}::${jobName}` so paired single/bulk processors on the
  // same queue no longer silently overwrite each other (ADR-0008).
  private processors: Map<string, JobProcessor> = new Map()
  private config: JobQueueConfig

  constructor(config?: Partial<JobQueueConfig>) {
    const baseRedisOptions = buildRedisConnectionOptions()

    this.config = {
      redis: {
        host: baseRedisOptions.host || 'localhost',
        port: baseRedisOptions.port || 6379,
        password: baseRedisOptions.password,
        db: baseRedisOptions.db || 0
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        ...config?.defaultJobOptions
      },
      concurrency: {
        'post-scheduling': 5,
        'analytics-collection': 3,
        'notification-dispatch': 10,
        'media-processing': 2,
        ...config?.concurrency
      },
      ...config
    }

    // Connection options handed to every BullMQ primitive. maxRetriesPerRequest
    // MUST be null for BullMQ v5 Workers (otherwise Worker construction throws).
    this.connectionOptions = {
      ...baseRedisOptions,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }

    // A single shared client used only for connection-status logging and the
    // ordered shutdown (workers → events → queues → redis). Not passed to BullMQ.
    this.redis = new Redis({
      ...baseRedisOptions,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true
    })

    this.setupRedisEvents()
  }

  /** Expose the resolved BullMQ connection options (worker bootstrap + monitoring build their own Queue handles). */
  getConnectionOptions(): ConnectionOptions {
    return this.connectionOptions
  }

  private setupRedisEvents(): void {
    this.redis.on('connect', () => {
      BusinessLogger.logSystemEvent('queue_redis_connected', {
        host: this.config.redis.host,
        port: this.config.redis.port
      })
    })

    this.redis.on('error', (error) => {
      ErrorLogger.logExternalServiceError('redis', error, {
        operation: 'queue_connection'
      })
    })

    this.redis.on('reconnecting', () => {
      BusinessLogger.logSystemEvent('queue_redis_reconnecting', {})
    })
  }

  async createQueue(name: string, options?: Partial<JobsOptions>): Promise<Queue> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!
    }

    const queue = new Queue(name, {
      connection: this.connectionOptions,
      defaultJobOptions: {
        ...this.config.defaultJobOptions,
        ...options
      }
    })

    this.queues.set(name, queue)

    // Set up queue events
    const queueEvents = new QueueEvents(name, {
      connection: this.connectionOptions
    })

    this.queueEvents.set(name, queueEvents)
    this.setupQueueEventHandlers(name, queueEvents)

    BusinessLogger.logSystemEvent('queue_created', {
      queueName: name,
      concurrency: this.config.concurrency[name] || 1
    })

    return queue
  }

  private setupQueueEventHandlers(queueName: string, queueEvents: QueueEvents): void {
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      BusinessLogger.logSystemEvent('job_completed', {
        queueName,
        jobId,
        success: true
      })
    })

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      ErrorLogger.logUnexpectedError(new Error(failedReason), {
        context: 'job_failed',
        queueName,
        jobId
      })
    })

    queueEvents.on('stalled', ({ jobId }) => {
      BusinessLogger.logSystemEvent('job_stalled', {
        queueName,
        jobId
      })
    })

    queueEvents.on('progress', ({ jobId, data }) => {
      BusinessLogger.logSystemEvent('job_progress', {
        queueName,
        jobId,
        progress: data
      })
    })
  }

  /**
   * Register a processor for a specific (queueName, jobName) pair. The worker
   * wrapper dispatches on BullMQ's `job.name`, so single-post and bulk-post
   * processors on the same queue coexist instead of overwriting one another.
   */
  registerProcessor<T = any>(queueName: string, jobName: string, processor: JobProcessor<T>): void {
    this.processors.set(`${queueName}${PROCESSOR_KEY_SEP}${jobName}`, processor as JobProcessor)
  }

  /** True if at least one processor is registered for the queue. */
  private queueHasProcessors(queueName: string): boolean {
    const prefix = `${queueName}${PROCESSOR_KEY_SEP}`
    for (const key of this.processors.keys()) {
      if (key.startsWith(prefix)) return true
    }
    return false
  }

  /**
   * Resolve the processor for a job. Prefer an exact (queueName, jobName) match;
   * fall back to the queue's sole processor when exactly one is registered (so a
   * queue with a single processor need not match on job name).
   */
  private resolveProcessor(queueName: string, jobName?: string): JobProcessor | undefined {
    if (jobName) {
      const exact = this.processors.get(`${queueName}${PROCESSOR_KEY_SEP}${jobName}`)
      if (exact) return exact
    }

    const prefix = `${queueName}${PROCESSOR_KEY_SEP}`
    let sole: JobProcessor | undefined
    let count = 0
    for (const [key, proc] of this.processors) {
      if (key.startsWith(prefix)) {
        sole = proc
        count++
        if (count > 1) break
      }
    }
    return count === 1 ? sole : undefined
  }

  /**
   * Create a worker for a queue. Returns null (skip + warn) when no processor is
   * registered for the queue — e.g. `media-processing`, reserved for ADR-0007 —
   * instead of throwing at bootstrap.
   */
  async createWorker(queueName: string): Promise<Worker | null> {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!
    }

    if (!this.queueHasProcessors(queueName)) {
      BusinessLogger.logSystemEvent('worker_skipped_no_processor', { queueName })
      return null
    }

    const worker = new Worker(
      queueName,
      async (job: Job) => {
        const timer = PerformanceLogger.startTimer(`job_processing_${queueName}`)

        const processor = this.resolveProcessor(queueName, job.name)
        if (!processor) {
          const message = `No processor registered for ${queueName}${PROCESSOR_KEY_SEP}${job.name}`
          ErrorLogger.logUnexpectedError(new Error(message), {
            context: 'job_processor_lookup',
            queueName,
            jobName: job.name,
            jobId: job.id
          })
          throw new Error(message)
        }

        try {
          BusinessLogger.logSystemEvent('job_started', {
            queueName,
            jobId: job.id,
            jobName: job.name,
            jobType: job.data.type,
            userId: job.data.userId,
            workspaceId: job.data.workspaceId,
            attempts: job.attemptsMade + 1
          })

          const result = await processor(job)

          timer.end({
            success: result.success,
            jobId: job.id,
            queueName,
            attempts: job.attemptsMade + 1
          })

          if (result.success) {
            BusinessLogger.logSystemEvent('job_success', {
              queueName,
              jobId: job.id,
              jobType: job.data.type,
              duration: timer.getDuration(),
              result: result.result
            })
          } else {
            throw new Error(result.error || 'Job processing failed')
          }

          return result.result

        } catch (error) {
          timer.end({
            success: false,
            error: true,
            jobId: job.id,
            queueName
          })

          ErrorLogger.logUnexpectedError(error as Error, {
            context: 'job_processing',
            queueName,
            jobId: job.id,
            jobType: job.data.type,
            attempts: job.attemptsMade + 1
          })

          throw error
        }
      },
      {
        connection: this.connectionOptions,
        concurrency: this.config.concurrency[queueName] || 1,
        removeOnComplete: this.config.defaultJobOptions.removeOnComplete,
        removeOnFail: this.config.defaultJobOptions.removeOnFail
      }
    )

    this.workers.set(queueName, worker)

    worker.on('ready', () => {
      BusinessLogger.logSystemEvent('worker_ready', {
        queueName,
        concurrency: this.config.concurrency[queueName] || 1
      })
    })

    worker.on('error', (error) => {
      ErrorLogger.logUnexpectedError(error, {
        context: 'worker_error',
        queueName
      })
    })

    return worker
  }

  async addJob<T = any>(
    queueName: string,
    jobData: JobData & { payload: T },
    options?: JobsOptions
  ): Promise<Job<T>> {
    const queue = await this.createQueue(queueName)
    
    const jobOptions: JobsOptions = {
      ...this.config.defaultJobOptions,
      ...options
    }

    // Handle scheduling
    if (jobData.scheduledFor) {
      const scheduleTime = new Date(jobData.scheduledFor)
      jobOptions.delay = Math.max(0, scheduleTime.getTime() - Date.now())
    }

    // Handle priority
    if (jobData.priority) {
      jobOptions.priority = jobData.priority
    }

    const job = await queue.add(jobData.type, jobData, jobOptions)

    BusinessLogger.logSystemEvent('job_added', {
      queueName,
      jobId: job.id,
      jobType: jobData.type,
      userId: jobData.userId,
      workspaceId: jobData.workspaceId,
      scheduledFor: jobData.scheduledFor,
      priority: jobData.priority
    })

    return job as Job<T>
  }

  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.queues.get(queueName)
    if (!queue) return null

    return await queue.getJob(jobId)
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId)
    if (job) {
      await job.remove()
      BusinessLogger.logSystemEvent('job_removed', {
        queueName,
        jobId
      })
    }
  }

  async getQueueStats(queueName: string): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
    paused: number
  }> {
    const queue = this.queues.get(queueName)
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`)
    }

    return await queue.getJobCounts()
  }

  async getAllQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {}
    
    for (const [queueName] of this.queues) {
      stats[queueName] = await this.getQueueStats(queueName)
    }

    return stats
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName)
    if (queue) {
      await queue.pause()
      BusinessLogger.logSystemEvent('queue_paused', { queueName })
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName)
    if (queue) {
      await queue.resume()
      BusinessLogger.logSystemEvent('queue_resumed', { queueName })
    }
  }

  async cleanQueue(
    queueName: string,
    grace: number = 0,
    status: 'completed' | 'failed' | 'active' | 'waiting' = 'completed'
  ): Promise<number> {
    const queue = this.queues.get(queueName)
    if (!queue) return 0

    const cleaned = await queue.clean(grace, status)

    BusinessLogger.logSystemEvent('queue_cleaned', {
      queueName,
      status,
      grace,
      cleaned: cleaned.length
    })

    return cleaned.length
  }

  async shutdown(): Promise<void> {
    BusinessLogger.logSystemEvent('queue_manager_shutdown', {
      queues: Array.from(this.queues.keys()),
      workers: Array.from(this.workers.keys())
    })

    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close()
      BusinessLogger.logSystemEvent('worker_closed', { queueName: name })
    }

    // Close all queue events
    for (const [name, queueEvents] of this.queueEvents) {
      await queueEvents.close()
      BusinessLogger.logSystemEvent('queue_events_closed', { queueName: name })
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close()
      BusinessLogger.logSystemEvent('queue_closed', { queueName: name })
    }

    // Close Redis connection
    await this.redis.quit()
    BusinessLogger.logSystemEvent('redis_connection_closed', {})
  }

  // Utility methods for job management
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId)
    if (job && job.failedReason) {
      await job.retry()
      BusinessLogger.logSystemEvent('job_retried', {
        queueName,
        jobId
      })
    }
  }

  async retryFailedJobs(queueName: string, limit: number = 100): Promise<number> {
    const queue = this.queues.get(queueName)
    if (!queue) return 0

    const failed = await queue.getFailed(0, limit - 1)
    let retried = 0

    for (const job of failed) {
      try {
        await job.retry()
        retried++
      } catch (error) {
        ErrorLogger.logUnexpectedError(error as Error, {
          context: 'retry_failed_job',
          queueName,
          jobId: job.id
        })
      }
    }

    BusinessLogger.logSystemEvent('failed_jobs_retried', {
      queueName,
      attempted: failed.length,
      retried
    })

    return retried
  }
}

// Singleton instance
export const queueManager = new QueueManager()