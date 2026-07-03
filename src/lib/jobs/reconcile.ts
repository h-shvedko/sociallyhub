/**
 * Crash-window reconciliation for scheduled posts (ADR-0008, Phase 3 step 9).
 *
 * Enqueue-after-commit is deliberately NOT transactional (a transactional outbox
 * was judged overkill at current scale — see the ADR). A crash between the DB
 * commit and the enqueue can therefore leave a post `SCHEDULED` with no backing
 * BullMQ job. This sweep closes that window: it finds SCHEDULED posts that are
 * past due yet have no live job and (re)enqueues them.
 *
 * The worker registers this as a repeatable job every 5 minutes
 * (`RECONCILE_INTERVAL_MS`). It is safe to run repeatedly and concurrently with
 * normal enqueues because `enqueuePublishJob` is idempotent by deterministic
 * jobId, and `publishJobExists` skips posts that already have a job (including a
 * permanently-failed one — we must not resurrect an exhausted retry chain).
 */
import { Job } from 'bullmq'

import { prisma } from '@/lib/prisma'
import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'

import { JobProcessor, JobResult } from './queue-manager'
import { enqueuePublishJob, publishJobExists } from './publish-queue'

/** Registered by the worker as the repeatable reconcile job's cadence. */
export const RECONCILE_INTERVAL_MS = 5 * 60 * 1000

/**
 * BullMQ job *name* for the reconcile sweep. It runs on the existing
 * `post-scheduling` queue (reusing that worker) under its own name so it
 * dispatches to `reconcileScheduledPostsProcessor` and never collides with
 * `post_scheduling` publish jobs.
 */
export const RECONCILE_JOB_NAME = 'reconcile_scheduled_posts'

/** Stable scheduler id — makes `upsertJobScheduler` idempotent across worker boots. */
export const RECONCILE_SCHEDULER_ID = 'reconcile-scheduled-posts'

export interface ReconcileResult {
  scanned: number
  enqueued: number
}

/**
 * Scan for past-due SCHEDULED posts with no live publish job and enqueue them.
 *
 * Only SCHEDULED posts are considered: a post that already published flips to
 * PUBLISHED/FAILED (processor, ADR-0008 step 5), and a future-scheduled post
 * that lost its job is picked up here at most `RECONCILE_INTERVAL_MS` after it
 * comes due. Per-post failures are logged and never abort the sweep.
 */
export async function reconcileScheduledPosts(): Promise<ReconcileResult> {
  const now = new Date()

  const duePosts = await prisma.post.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    select: {
      id: true,
      workspaceId: true,
      ownerId: true,
      scheduledAt: true,
    },
  })

  let enqueued = 0

  for (const post of duePosts) {
    try {
      if (await publishJobExists(post.id)) {
        continue
      }

      await enqueuePublishJob({
        postId: post.id,
        workspaceId: post.workspaceId,
        userId: post.ownerId,
        // Past due — publish immediately rather than re-delaying.
        scheduledAt: null,
      })
      enqueued++

      BusinessLogger.logSystemEvent('scheduled_post_reconciled', {
        postId: post.id,
        workspaceId: post.workspaceId,
        scheduledAt: post.scheduledAt?.toISOString(),
      })
    } catch (error) {
      // One bad post must not stop the sweep; the next run retries it.
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'reconcile_scheduled_posts',
        postId: post.id,
      })
    }
  }

  BusinessLogger.logSystemEvent('reconcile_scheduled_posts_completed', {
    scanned: duePosts.length,
    enqueued,
  })

  return { scanned: duePosts.length, enqueued }
}

/**
 * BullMQ processor wrapper for the repeatable reconcile job. Registered by
 * `JobScheduler` on the post-scheduling queue under `RECONCILE_JOB_NAME`. Always
 * resolves `success: true` (a scan finding nothing is a normal, non-error
 * outcome); a thrown DB error propagates to BullMQ for a normal retry.
 */
export const reconcileScheduledPostsProcessor: JobProcessor = async (
  _job: Job
): Promise<JobResult> => {
  const result = await reconcileScheduledPosts()
  return {
    success: true,
    result,
    metrics: {
      duration: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: new Date().toISOString(),
    },
  }
}
