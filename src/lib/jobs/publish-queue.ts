/**
 * Publish-queue helpers (ADR-0008, Phase 3).
 *
 * The single seam through which every enqueue/reschedule/cancel of a post's
 * publish job flows: `/api/posts` POST, `/api/posts/[id]` PUT/DELETE,
 * `/api/social/post`, and the reconciliation sweep all go through here so the
 * queue name, the processor's job name, and — crucially — the deterministic,
 * idempotent jobId are defined in exactly one place.
 *
 * Idempotency: BullMQ dedupes an `add` whose jobId already exists (it silently
 * keeps the old job). So every (re)enqueue removes any existing job for the post
 * first, then adds a fresh one — a reschedule genuinely moves the timing instead
 * of being ignored.
 */
import { queueManager } from './queue-manager'

/** Queue that the (rewritten, DB-backed) post-scheduling processor consumes. */
export const POST_SCHEDULING_QUEUE = 'post-scheduling'

/**
 * BullMQ job *name* the single-post processor is registered under in
 * job-scheduler.ts:
 *   registerProcessor('post-scheduling', 'post_scheduling', postSchedulingProcessor)
 * `queueManager.addJob` uses the `type` field as the BullMQ job name, and the
 * worker wrapper dispatches on `job.name`. This constant MUST stay in lockstep
 * with that registration or jobs will land with no matching processor.
 */
export const PUBLISH_JOB_NAME = 'post_scheduling'

/** Deterministic, idempotent BullMQ jobId for a post's publish job. */
export function publishJobId(postId: string): string {
  return `publish:${postId}`
}

export interface EnqueuePublishParams {
  postId: string
  workspaceId: string
  /** Post owner / acting user — carried for logging + owner notifications. */
  userId: string
  /**
   * When set to a future time (SCHEDULED), the job is delayed until then.
   * `null`/`undefined` or a past time (PUBLISHED, or a past-due reconcile) means
   * publish immediately.
   */
  scheduledAt?: Date | null
}

/**
 * Ensure the queue object exists in *this* process's registry.
 *
 * Queues are created lazily by `addJob`, but `removeJob`/`getJob` only read the
 * in-process map — in a fresh web/worker process the map is empty. Without this,
 * a reschedule would find no local queue, skip the remove, and then BullMQ would
 * dedupe the re-add by jobId, silently preserving the stale timing. Creating the
 * queue here makes remove/get resolve the real queue and hit Redis.
 */
async function ensureQueue(): Promise<void> {
  await queueManager.createQueue(POST_SCHEDULING_QUEUE)
}

/**
 * Enqueue (or re-enqueue) a post's publish job.
 *
 * Remove-then-add against a deterministic jobId, so a reschedule replaces the
 * old job rather than being deduped. Publishing jobs get `attempts: 5` with
 * exponential backoff starting at 30s (ADR-0008 step 6). Throws on failure so
 * callers can roll the post status back (ADR-0008 step 3) — never swallow.
 *
 * @returns the BullMQ jobId of the enqueued job.
 */
export async function enqueuePublishJob(params: EnqueuePublishParams): Promise<string> {
  const { postId, workspaceId, userId, scheduledAt } = params
  const jobId = publishJobId(postId)

  await ensureQueue()

  // Replace any prior job for this post so the timing is authoritative.
  await queueManager.removeJob(POST_SCHEDULING_QUEUE, jobId)

  const scheduledFor =
    scheduledAt && scheduledAt.getTime() > Date.now() ? scheduledAt.toISOString() : undefined

  const job = await queueManager.addJob(
    POST_SCHEDULING_QUEUE,
    {
      id: jobId,
      type: PUBLISH_JOB_NAME,
      // The processor (ADR-0008 step 7) loads the Post, its PostVariants, and
      // each variant's SocialAccount from the DB by postId — so postId is the
      // only payload the pipeline needs. userId/workspaceId ride on the envelope
      // for logging + notifications.
      payload: { postId },
      userId,
      workspaceId,
      createdAt: new Date().toISOString(),
      // addJob turns `scheduledFor` into the BullMQ delay; omit it for immediate.
      ...(scheduledFor ? { scheduledFor } : {}),
    },
    {
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
    }
  )

  return job.id as string
}

/**
 * Cancel a post's publish job (unschedule / delete / transition out of a
 * queued status). No-op when no such job exists. Throws if the queue backend is
 * unreachable so callers can decide how to keep DB and queue consistent.
 */
export async function removePublishJob(postId: string): Promise<void> {
  await ensureQueue()
  await queueManager.removeJob(POST_SCHEDULING_QUEUE, publishJobId(postId))
}

/**
 * Whether a live BullMQ job currently exists for this post (delayed, waiting,
 * active, failed, or completed-but-not-yet-evicted). Used by the reconcile sweep
 * to avoid re-enqueueing a post that already has — or has exhausted — a job.
 */
export async function publishJobExists(postId: string): Promise<boolean> {
  await ensureQueue()
  const job = await queueManager.getJob(POST_SCHEDULING_QUEUE, publishJobId(postId))
  return job !== null && job !== undefined
}
