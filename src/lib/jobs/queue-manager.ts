import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq'
import Redis from 'ioredis'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'

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
  private queues: Map<string, Queue> = new Map()
  private workers: Map<string, Worker> = new Map()
  private queueEvents: Map<string, QueueEvents> = new Map()
  private processors: Map<string, JobProcessor> = new Map()
  private config: JobQueueConfig

  constructor(config?: Partial<JobQueueConfig>) {
    this.config = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
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

    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true
    })

    this.setupRedisEvents()
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
      connection: this.redis,
      defaultJobOptions: {
        ...this.config.defaultJobOptions,
        ...options
      }
    })

    this.queues.set(name, queue)

    // Set up queue events
    const queueEvents = new QueueEvents(name, {
      connection: this.redis
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

  registerProcessor<T = any>(queueName: string, processor: JobProcessor<T>): void {
    this.processors.set(queueName, processor)
  }

  async createWorker(queueName: string): Promise<Worker> {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!
    }

    const processor = this.processors.get(queueName)
    if (!processor) {
      throw new Error(`No processor registered for queue: ${queueName}`)
    }

    const worker = new Worker(
      queueName,
      async (job: Job) => {
        const timer = PerformanceLogger.startTimer(`job_processing_${queueName}`)
        
        try {
          BusinessLogger.logSystemEvent('job_started', {
            queueName,
            jobId: job.id,
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
        connection: this.redis,
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