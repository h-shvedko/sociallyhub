/**
 * Read-only BullMQ Queue handles for the `/api/jobs/*` monitoring endpoints
 * (ADR-0008, Phase 5).
 *
 * These routes run inside the web process, which does NOT host workers. A BullMQ
 * `Queue` is a plain Redis *client* (it never blocks on job reservation the way a
 * `Worker` does), so constructing one in the web tier is safe and is exactly how
 * the ADR says to read real queue state instead of the manager's in-process
 * (always-empty-in-web) `queues` Map.
 *
 * Handles are memoized on `globalThis` and reused across requests: the monitoring
 * dashboard polls stats/health/details every ~5s, so opening + closing a Redis
 * connection per request would churn connections needlessly. The `globalThis`
 * guard also prevents Next.js dev hot-reload from leaking a fresh connection set
 * on every recompile (same pattern as the Prisma singleton).
 */
import { Queue } from 'bullmq'

import { queueManager } from './queue-manager'

/**
 * Queues the monitoring endpoints report on. Mirrors the queues the worker
 * actually hosts (`src/worker.ts` HOSTED_QUEUES + `job-scheduler` processor
 * registrations). Intentionally excluded:
 *  - `media-processing` — reserved for ADR-0007; no processor, no jobs.
 *  - `client-reports` — add here once ADR-0008 Phase 4 lands its queue.
 */
export const KNOWN_QUEUE_NAMES = [
  'post-scheduling',
  'analytics-collection',
  'notification-dispatch',
] as const

export type KnownQueueName = (typeof KNOWN_QUEUE_NAMES)[number]

/** BullMQ job states surfaced to the monitoring UI (its filter set). */
export const MONITORED_JOB_STATES = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
] as const

export type MonitoredJobState = (typeof MONITORED_JOB_STATES)[number]

const globalForQueues = globalThis as unknown as {
  __jobMonitoringQueues?: Map<string, Queue>
}

function handleMap(): Map<string, Queue> {
  if (!globalForQueues.__jobMonitoringQueues) {
    globalForQueues.__jobMonitoringQueues = new Map<string, Queue>()
  }
  return globalForQueues.__jobMonitoringQueues
}

/**
 * Lazily build (and memoize) a read-only Queue handle for a known queue, reusing
 * the queue manager's resolved connection options (REDIS_URL-aware,
 * `maxRetriesPerRequest: null`). Handles are long-lived by design — do not close
 * them per request.
 */
export function getMonitoringQueue(name: string): Queue {
  const map = handleMap()
  let queue = map.get(name)
  if (!queue) {
    queue = new Queue(name, { connection: queueManager.getConnectionOptions() })
    map.set(name, queue)
  }
  return queue
}

/** Narrowing helper: is `name` one of the queues we monitor? */
export function isKnownQueue(name: string): name is KnownQueueName {
  return (KNOWN_QUEUE_NAMES as readonly string[]).includes(name)
}

/** Narrowing helper: is `state` one of the job states we surface? */
export function isMonitoredState(state: string): state is MonitoredJobState {
  return (MONITORED_JOB_STATES as readonly string[]).includes(state)
}
