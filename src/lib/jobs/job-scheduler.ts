import { queueManager } from './queue-manager'
import { postSchedulingProcessor, bulkPostSchedulingProcessor } from './processors/post-scheduling'
import { analyticsCollectionProcessor, scheduledAnalyticsProcessor } from './processors/analytics-collection'
import { notificationDispatchProcessor, bulkNotificationDispatchProcessor } from './processors/notification-dispatch'
import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'

export class JobScheduler {
  private initialized = false
  private workers: Map<string, any> = new Map()

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      BusinessLogger.logSystemEvent('job_scheduler_initializing', {
        timestamp: new Date().toISOString()
      })

      // Register all job processors
      queueManager.registerProcessor('post-scheduling', postSchedulingProcessor)
      queueManager.registerProcessor('post-scheduling', bulkPostSchedulingProcessor)
      queueManager.registerProcessor('analytics-collection', analyticsCollectionProcessor)
      queueManager.registerProcessor('analytics-collection', scheduledAnalyticsProcessor)
      queueManager.registerProcessor('notification-dispatch', notificationDispatchProcessor)
      queueManager.registerProcessor('notification-dispatch', bulkNotificationDispatchProcessor)

      // Create and start workers for each queue
      const queueConfigs = [
        { name: 'post-scheduling', concurrency: 5 },
        { name: 'analytics-collection', concurrency: 3 },
        { name: 'notification-dispatch', concurrency: 10 },
        { name: 'media-processing', concurrency: 2 }
      ]

      for (const config of queueConfigs) {
        try {
          const worker = await queueManager.createWorker(config.name)
          this.workers.set(config.name, worker)
          
          BusinessLogger.logSystemEvent('worker_started', {
            queueName: config.name,
            concurrency: config.concurrency
          })
        } catch (error) {
          ErrorLogger.logUnexpectedError(error as Error, {
            context: 'worker_initialization',
            queueName: config.name
          })
        }
      }

      // Set up recurring scheduled jobs
      await this.scheduleRecurringJobs()

      this.initialized = true

      BusinessLogger.logSystemEvent('job_scheduler_initialized', {
        workersCount: this.workers.size,
        queues: Array.from(this.workers.keys())
      })

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'job_scheduler_initialization'
      })
      throw error
    }
  }

  private async scheduleRecurringJobs(): Promise<void> {
    try {
      // Schedule analytics collection jobs
      await this.scheduleAnalyticsCollection()
      
      // Schedule cleanup jobs
      await this.scheduleCleanupJobs()

      // Schedule health check jobs
      await this.scheduleHealthChecks()

      BusinessLogger.logSystemEvent('recurring_jobs_scheduled', {
        jobTypes: ['analytics_collection', 'cleanup', 'health_checks']
      })

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'schedule_recurring_jobs'
      })
    }
  }

  private async scheduleAnalyticsCollection(): Promise<void> {
    // Schedule hourly analytics collection
    const hourlyJob = await queueManager.addJob('analytics-collection', {
      id: 'hourly_analytics',
      type: 'scheduled_analytics',
      payload: {
        userId: 'system',
        workspaceId: 'all',
        frequency: 'hourly' as const,
        accounts: [] // Will be populated by the processor
      },
      userId: 'system',
      createdAt: new Date().toISOString()
    }, {
      repeat: {
        pattern: '0 * * * *' // Every hour at minute 0
      },
      removeOnComplete: 5,
      removeOnFail: 3
    })

    // Schedule daily analytics collection
    const dailyJob = await queueManager.addJob('analytics-collection', {
      id: 'daily_analytics',
      type: 'scheduled_analytics',
      payload: {
        userId: 'system',
        workspaceId: 'all',
        frequency: 'daily' as const,
        accounts: []
      },
      userId: 'system',
      createdAt: new Date().toISOString()
    }, {
      repeat: {
        pattern: '0 2 * * *' // Every day at 2:00 AM
      },
      removeOnComplete: 7,
      removeOnFail: 3
    })

    // Schedule weekly analytics collection
    const weeklyJob = await queueManager.addJob('analytics-collection', {
      id: 'weekly_analytics',
      type: 'scheduled_analytics',
      payload: {
        userId: 'system',
        workspaceId: 'all',
        frequency: 'weekly' as const,
        accounts: []
      },
      userId: 'system',
      createdAt: new Date().toISOString()
    }, {
      repeat: {
        pattern: '0 3 * * 1' // Every Monday at 3:00 AM
      },
      removeOnComplete: 4,
      removeOnFail: 2
    })

    BusinessLogger.logSystemEvent('analytics_collection_scheduled', {
      hourlyJob: hourlyJob.id,
      dailyJob: dailyJob.id,
      weeklyJob: weeklyJob.id
    })
  }

  private async scheduleCleanupJobs(): Promise<void> {
    // Clean completed jobs daily
    const cleanupJob = await queueManager.addJob('notification-dispatch', {
      id: 'queue_cleanup',
      type: 'queue_cleanup',
      payload: {
        operation: 'clean_completed',
        olderThan: 24 * 60 * 60 * 1000, // 24 hours
        maxJobs: 1000
      },
      userId: 'system',
      createdAt: new Date().toISOString()
    }, {
      repeat: {
        pattern: '0 4 * * *' // Every day at 4:00 AM
      },
      removeOnComplete: 3,
      removeOnFail: 1
    })

    BusinessLogger.logSystemEvent('cleanup_jobs_scheduled', {
      cleanupJob: cleanupJob.id
    })
  }

  private async scheduleHealthChecks(): Promise<void> {
    // Health check every 15 minutes
    const healthCheckJob = await queueManager.addJob('notification-dispatch', {
      id: 'health_check',
      type: 'health_check',
      payload: {
        checkAll: true,
        alertOnIssues: true
      },
      userId: 'system',
      createdAt: new Date().toISOString()
    }, {
      repeat: {
        pattern: '*/15 * * * *' // Every 15 minutes
      },
      removeOnComplete: 10,
      removeOnFail: 5
    })

    BusinessLogger.logSystemEvent('health_checks_scheduled', {
      healthCheckJob: healthCheckJob.id
    })
  }

  // Public API for scheduling jobs
  async schedulePost(data: {
    postId: string
    content: any
    platforms: string[]
    scheduledFor: string
    userId: string
    workspaceId: string
    accountIds: Record<string, string>
    platformSpecificSettings?: Record<string, any>
  }): Promise<string> {
    try {
      const job = await queueManager.addJob('post-scheduling', {
        id: `post_${data.postId}`,
        type: 'post_scheduling',
        payload: data,
        userId: data.userId,
        workspaceId: data.workspaceId,
        createdAt: new Date().toISOString(),
        scheduledFor: data.scheduledFor
      }, {
        delay: Math.max(0, new Date(data.scheduledFor).getTime() - Date.now()),
        priority: 0,
        attempts: 3
      })

      BusinessLogger.logSystemEvent('post_scheduled', {
        postId: data.postId,
        platforms: data.platforms,
        scheduledFor: data.scheduledFor,
        userId: data.userId,
        jobId: job.id
      })

      return job.id as string

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'schedule_post',
        postId: data.postId,
        userId: data.userId
      })
      throw error
    }
  }

  async scheduleBulkPosts(data: {
    posts: Array<{
      postId: string
      content: any
      platforms: string[]
      scheduledFor: string
      accountIds: Record<string, string>
    }>
    userId: string
    workspaceId: string
    batchId: string
  }): Promise<string> {
    try {
      const job = await queueManager.addJob('post-scheduling', {
        id: `bulk_${data.batchId}`,
        type: 'bulk_post_scheduling',
        payload: data,
        userId: data.userId,
        workspaceId: data.workspaceId,
        createdAt: new Date().toISOString()
      }, {
        priority: -5, // Lower priority for bulk operations
        attempts: 2
      })

      BusinessLogger.logSystemEvent('bulk_posts_scheduled', {
        batchId: data.batchId,
        postsCount: data.posts.length,
        userId: data.userId,
        jobId: job.id
      })

      return job.id as string

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'schedule_bulk_posts',
        batchId: data.batchId,
        userId: data.userId
      })
      throw error
    }
  }

  async scheduleAnalyticsCollection(data: {
    userId: string
    workspaceId: string
    accounts: Array<{ platform: string; accountId: string }>
    dateRange: { start: string; end: string }
    metrics: string[]
    priority?: number
  }): Promise<string> {
    try {
      const job = await queueManager.addJob('analytics-collection', {
        id: `analytics_${Date.now()}_${data.userId}`,
        type: 'analytics_collection',
        payload: data,
        userId: data.userId,
        workspaceId: data.workspaceId,
        createdAt: new Date().toISOString()
      }, {
        priority: data.priority || 0,
        attempts: 3
      })

      BusinessLogger.logSystemEvent('analytics_collection_scheduled', {
        userId: data.userId,
        accountsCount: data.accounts.length,
        dateRange: data.dateRange,
        jobId: job.id
      })

      return job.id as string

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'schedule_analytics_collection',
        userId: data.userId
      })
      throw error
    }
  }

  async scheduleNotification(data: {
    notification: any
    preferences: any
    channels: string[]
    scheduledFor?: string
    priority?: number
  }): Promise<string> {
    try {
      const job = await queueManager.addJob('notification-dispatch', {
        id: `notification_${data.notification.id}`,
        type: 'notification_dispatch',
        payload: data,
        userId: data.notification.userId,
        workspaceId: data.notification.workspaceId,
        createdAt: new Date().toISOString(),
        scheduledFor: data.scheduledFor
      }, {
        delay: data.scheduledFor ? Math.max(0, new Date(data.scheduledFor).getTime() - Date.now()) : 0,
        priority: data.priority || 0,
        attempts: 3
      })

      BusinessLogger.logNotificationEvent('notification_scheduled', data.notification.userId, {
        notificationId: data.notification.id,
        channels: data.channels,
        scheduledFor: data.scheduledFor,
        jobId: job.id
      })

      return job.id as string

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'schedule_notification',
        notificationId: data.notification.id
      })
      throw error
    }
  }

  // Job management methods
  async cancelJob(queueName: string, jobId: string): Promise<void> {
    try {
      await queueManager.removeJob(queueName, jobId)
      
      BusinessLogger.logSystemEvent('job_cancelled', {
        queueName,
        jobId
      })

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'cancel_job',
        queueName,
        jobId
      })
      throw error
    }
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    try {
      await queueManager.retryJob(queueName, jobId)
      
      BusinessLogger.logSystemEvent('job_retried_manual', {
        queueName,
        jobId
      })

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'retry_job',
        queueName,
        jobId
      })
      throw error
    }
  }

  async getJobStats(): Promise<any> {
    try {
      return await queueManager.getAllQueueStats()
    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'get_job_stats'
      })
      throw error
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    try {
      BusinessLogger.logSystemEvent('job_scheduler_shutting_down', {
        workersCount: this.workers.size
      })

      await queueManager.shutdown()
      
      this.workers.clear()
      this.initialized = false

      BusinessLogger.logSystemEvent('job_scheduler_shutdown_complete', {})

    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'job_scheduler_shutdown'
      })
      throw error
    }
  }
}

// Singleton instance
export const jobScheduler = new JobScheduler()

// Auto-initialize in production
if (process.env.NODE_ENV === 'production' || process.env.INIT_JOBS === 'true') {
  jobScheduler.initialize().catch(error => {
    console.error('Failed to initialize job scheduler:', error)
  })
}