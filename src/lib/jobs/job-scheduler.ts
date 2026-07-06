import { queueManager } from './queue-manager'
import { postSchedulingProcessor, bulkPostSchedulingProcessor } from './processors/post-scheduling'
import { analyticsCollectionProcessor, scheduledAnalyticsProcessor } from './processors/analytics-collection'
import { notificationDispatchProcessor } from './processors/notification-dispatch'
import {
  reconcileScheduledPostsProcessor,
  RECONCILE_JOB_NAME,
  RECONCILE_SCHEDULER_ID,
  RECONCILE_INTERVAL_MS,
} from './reconcile'
import { clientReportsProcessor } from './processors/client-reports'
import {
  CLIENT_REPORTS_QUEUE,
  CLIENT_REPORT_JOB_NAME,
  upsertClientReportScheduler,
  removeClientReportScheduler,
} from './client-reports-queue'
import {
  inboxSyncProcessor,
  INBOX_SYNC_QUEUE,
  INBOX_SYNC_JOB_NAME,
  INBOX_SYNC_SCHEDULER_ID,
  INBOX_SYNC_INTERVAL_MS,
} from './processors/inbox-sync'
import { prisma } from '@/lib/prisma'
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

      // Register all job processors, keyed by (queueName, jobName) so paired
      // single/bulk processors no longer overwrite each other (ADR-0008). The
      // jobName MUST match the `type` field enqueued via queueManager.addJob,
      // which BullMQ uses as job.name for dispatch.
      queueManager.registerProcessor('post-scheduling', 'post_scheduling', postSchedulingProcessor)
      queueManager.registerProcessor('post-scheduling', 'bulk_post_scheduling', bulkPostSchedulingProcessor)
      queueManager.registerProcessor('analytics-collection', 'analytics_collection', analyticsCollectionProcessor)
      queueManager.registerProcessor('analytics-collection', 'scheduled_analytics', scheduledAnalyticsProcessor)
      // ADR-0010: a single dispatch job name. Every notification is enqueued by
      // notifyUser() as one `notification_dispatch` job carrying only the
      // notificationId — the processor resolves recipient + channel preferences
      // from the DB and fans out in-app/email/push per user preferences. The old
      // `bulk_notification_dispatch` processor (which shared this queue key and
      // silently overwrote the single one before ADR-0008 re-keyed by jobName) was
      // removed: notifyUsers() now fans out to individual notifyUser() calls, each
      // its own single job, so there is no second processor to collide.
      queueManager.registerProcessor('notification-dispatch', 'notification_dispatch', notificationDispatchProcessor)

      // Client-report generation (ADR-0008 Phase 4). Both the per-schedule
      // repeatable and the manual "run now" one-off fire this job name.
      queueManager.registerProcessor(CLIENT_REPORTS_QUEUE, CLIENT_REPORT_JOB_NAME, clientReportsProcessor)

      // Reconcile sweep (ADR-0008 Phase 3 step 9) runs on the post-scheduling
      // queue under its own job name, so the existing post-scheduling worker
      // dispatches it. Registered here (single registration authority); the
      // repeatable itself is upserted by scheduleReconcileScheduledPosts(), which
      // the worker calls during repeatable-job sync.
      queueManager.registerProcessor('post-scheduling', RECONCILE_JOB_NAME, reconcileScheduledPostsProcessor)

      // Inbox-sync ingestion (ADR-0009 Phase 1.6) runs on its own queue so a slow
      // mentions poll never contends with the publishing pipeline. The repeatable
      // itself is upserted by scheduleInboxSync(), invoked during repeatable sync.
      queueManager.registerProcessor(INBOX_SYNC_QUEUE, INBOX_SYNC_JOB_NAME, inboxSyncProcessor)

      // Create and start workers for each queue. `media-processing` is omitted:
      // no processor exists (reserved for ADR-0007), and createWorker would skip
      // it anyway.
      const queueConfigs = [
        { name: 'post-scheduling', concurrency: 5 },
        { name: 'analytics-collection', concurrency: 3 },
        { name: 'notification-dispatch', concurrency: 10 },
        { name: CLIENT_REPORTS_QUEUE, concurrency: 3 },
        { name: INBOX_SYNC_QUEUE, concurrency: 2 }
      ]

      for (const config of queueConfigs) {
        try {
          const worker = await queueManager.createWorker(config.name)
          if (!worker) {
            // No processor registered for this queue — skipped (not fatal).
            continue
          }
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
    // Recurring repeatables are intentionally DISABLED in Phase 1 (ADR-0008):
    //  - analytics-collection repeatables (scheduleAnalyticsCollection) stay off
    //    until real provider analytics exist (ADR-0009); scheduling them today
    //    only burns retries against stub providers.
    //  - cleanup / health-check repeatables enqueue job names ('queue_cleanup',
    //    'health_check') for which no processor is registered — they would create
    //    perpetually-failing recurring jobs. Real health/observability lands in
    //    ADR-0023.
    // The private schedule* helpers are retained (uncalled) for when those ADRs
    // enable them. Client-report repeatables are added in Phase 4.
    BusinessLogger.logSystemEvent('recurring_jobs_deferred', {
      deferred: ['analytics_collection', 'cleanup', 'health_checks'],
      reason: 'ADR-0008 Phase 1: no repeatables until ADR-0009/ADR-0023'
    })
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

  /**
   * Upsert the repeatable reconcile-scheduled-posts sweep (ADR-0008 Phase 3
   * step 9). Discovered and invoked by the worker's repeatable-job sync
   * (src/worker.ts). Uses the v5 Job Schedulers API with a stable scheduler id,
   * so re-running it on every worker boot is idempotent (no duplicate timers).
   * Runs on the post-scheduling queue under RECONCILE_JOB_NAME.
   */
  async scheduleReconcileScheduledPosts(): Promise<void> {
    try {
      const queue = await queueManager.createQueue('post-scheduling')

      await queue.upsertJobScheduler(
        RECONCILE_SCHEDULER_ID,
        { every: RECONCILE_INTERVAL_MS },
        {
          name: RECONCILE_JOB_NAME,
          data: {
            id: RECONCILE_SCHEDULER_ID,
            type: RECONCILE_JOB_NAME,
            payload: {},
            userId: 'system',
            createdAt: new Date().toISOString(),
          },
          opts: {
            removeOnComplete: 20,
            removeOnFail: 20,
          },
        }
      )

      BusinessLogger.logSystemEvent('reconcile_scheduled_posts_repeatable_upserted', {
        schedulerId: RECONCILE_SCHEDULER_ID,
        everyMs: RECONCILE_INTERVAL_MS,
      })
    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'schedule_reconcile_scheduled_posts',
      })
      throw error
    }
  }

  /**
   * Upsert the repeatable inbox-sync poll (ADR-0009 Phase 1.6). Discovered and
   * invoked by the worker's repeatable-job sync (src/worker.ts). Uses the v5 Job
   * Schedulers API with a stable scheduler id, so re-running it on every worker
   * boot is idempotent (no duplicate timers). Fires with an empty payload so the
   * processor sweeps every pollable account; it stays effectively idle (finds no
   * pollable accounts) until real credentials exist.
   */
  async scheduleInboxSync(): Promise<void> {
    try {
      const queue = await queueManager.createQueue(INBOX_SYNC_QUEUE)

      await queue.upsertJobScheduler(
        INBOX_SYNC_SCHEDULER_ID,
        { every: INBOX_SYNC_INTERVAL_MS },
        {
          name: INBOX_SYNC_JOB_NAME,
          data: {
            id: INBOX_SYNC_SCHEDULER_ID,
            type: INBOX_SYNC_JOB_NAME,
            payload: {},
            userId: 'system',
            createdAt: new Date().toISOString(),
          },
          opts: {
            removeOnComplete: 20,
            removeOnFail: 20,
          },
        }
      )

      BusinessLogger.logSystemEvent('inbox_sync_repeatable_upserted', {
        schedulerId: INBOX_SYNC_SCHEDULER_ID,
        everyMs: INBOX_SYNC_INTERVAL_MS,
      })
    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'schedule_inbox_sync',
      })
      throw error
    }
  }

  /**
   * Full resync of ClientReportSchedule rows → BullMQ repeatable job schedulers
   * (ADR-0008 Phase 4). Called on worker boot (picked up automatically by
   * src/worker.ts's repeatable-sync candidate list). Active rows are upserted
   * (idempotent by scheduler id — a changed cadence replaces the old timer);
   * inactive rows have any lingering scheduler removed, correcting drift left by
   * a crash between a CRUD mutation and its queue write. Per-row failures are
   * logged and never abort the sweep.
   */
  async syncClientReportSchedules(): Promise<void> {
    try {
      const schedules = await prisma.clientReportSchedule.findMany({
        select: {
          id: true,
          frequency: true,
          time: true,
          dayOfWeek: true,
          dayOfMonth: true,
          workspaceId: true,
          isActive: true,
        },
      })

      let upserted = 0
      let removed = 0

      for (const schedule of schedules) {
        try {
          if (schedule.isActive) {
            await upsertClientReportScheduler(schedule)
            upserted++
          } else {
            await removeClientReportScheduler(schedule.id)
            removed++
          }
        } catch (error) {
          ErrorLogger.logUnexpectedError(error as Error, {
            context: 'sync_client_report_schedule',
            scheduleId: schedule.id,
          })
        }
      }

      BusinessLogger.logSystemEvent('client_report_schedules_synced', {
        total: schedules.length,
        upserted,
        removed,
      })
    } catch (error) {
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'sync_client_report_schedules',
      })
      throw error
    }
  }

  // Renamed from scheduleAnalyticsCollection to fix TS2393 (duplicate impl with
  // the private repeatable-scheduling helper of the same name). This is the
  // on-demand enqueue used by callers; the private one schedules repeatables.
  async enqueueAnalyticsCollection(data: {
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

// Singleton instance.
//
// NOTE (ADR-0008): there is deliberately NO module-level auto-init here. The
// production worker bootstrap is owned by the dedicated `src/worker.ts` process
// (added in Phase 2), which explicitly calls `jobScheduler.initialize()`. Auto
// starting workers on import (the former NODE_ENV/INIT_JOBS block) shipped broken
// and unobserved — importing this module must have no side effects. INIT_JOBS, if
// re-introduced, may only be a dev-in-process convenience invoked explicitly by an
// entrypoint, never an import side effect.
export const jobScheduler = new JobScheduler()