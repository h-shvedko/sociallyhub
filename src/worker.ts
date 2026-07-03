/**
 * SociallyHub background worker entrypoint (ADR-0008, Phase 2).
 *
 * This is the ONE explicit place that starts BullMQ workers. Importing any queue
 * module has NO side effects (the old `NODE_ENV`/`INIT_JOBS` module self-init was
 * deleted in Phase 1); nothing starts processing until this bootstrap runs. That
 * makes worker startup auditable — the failure mode that shipped broken and
 * unobserved (implicit init) cannot recur.
 *
 * Responsibilities:
 *   1. Fail-fast DB connectivity check (a worker with no DB is useless).
 *   2. Register every processor by (queueName, jobName) and create the workers
 *      — delegated to `jobScheduler.initialize()`, the single registration
 *      authority (repaired in Phase 1). Queues covered today: post-scheduling
 *      (post_scheduling + bulk_post_scheduling), analytics-collection,
 *      notification-dispatch. `client-reports` flows through the same call once
 *      Phase 4 adds it there.
 *   3. Sync DB-backed repeatable jobs (client-report schedules,
 *      reconcile-scheduled-posts) — called defensively so this phase lands before
 *      the sibling phases that add those methods.
 *   4. Publish a Redis liveness heartbeat (`worker:heartbeat`) for the compose
 *      healthcheck.
 *   5. Graceful SIGTERM/SIGINT shutdown via `queueManager.shutdown()`.
 *
 * Run:
 *   dev:  npm run worker       (tsx src/worker.ts)
 *   prod: node dist/worker.js  (bundled via npm run build:worker)
 */
import Redis from 'ioredis'
import { queueManager, buildRedisConnectionOptions } from '@/lib/jobs/queue-manager'
import { jobScheduler } from '@/lib/jobs/job-scheduler'
import { prisma } from '@/lib/prisma'
import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'

/** Redis key polled by the docker healthcheck to confirm the worker is alive. */
const HEARTBEAT_KEY = 'worker:heartbeat'
/** Heartbeat key TTL — expires if the worker dies/hangs (healthcheck then fails). */
const HEARTBEAT_TTL_SECONDS = 60
/** Refresh cadence — comfortably inside the TTL so a single missed tick is tolerated. */
const HEARTBEAT_REFRESH_MS = 20_000
/** Hard cap on graceful shutdown before we force-exit so orchestrators aren't blocked. */
const SHUTDOWN_TIMEOUT_MS = 30_000

/** Queues this worker hosts today (for the startup banner / logs). */
const HOSTED_QUEUES = ['post-scheduling', 'analytics-collection', 'notification-dispatch']

let heartbeatTimer: NodeJS.Timeout | null = null
let heartbeatRedis: Redis | null = null
let shuttingDown = false

/** Fail fast if the database is unreachable — the publish pipeline is DB-backed. */
async function checkDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`
}

/**
 * Start the Redis liveness heartbeat. Uses its own ioredis client (not a BullMQ
 * connection) so heartbeat writes never contend with worker blocking commands.
 */
async function startHeartbeat(): Promise<void> {
  heartbeatRedis = new Redis({
    ...buildRedisConnectionOptions(),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })
  heartbeatRedis.on('error', (err) => {
    ErrorLogger.logExternalServiceError('redis', err, { operation: 'worker_heartbeat' })
  })

  await heartbeatRedis.connect()

  const write = async () => {
    try {
      await heartbeatRedis!.set(HEARTBEAT_KEY, Date.now().toString(), 'EX', HEARTBEAT_TTL_SECONDS)
    } catch (err) {
      ErrorLogger.logExternalServiceError('redis', err as Error, { operation: 'worker_heartbeat_write' })
    }
  }

  await write()
  // Not unref'd: keeps the process alive as an explicit liveness signal even if
  // (defensively) no workers were created. cleared during shutdown.
  heartbeatTimer = setInterval(write, HEARTBEAT_REFRESH_MS)
}

/**
 * Sync DB-backed repeatable jobs. The concrete methods (client-report schedule
 * sync, reconcile-scheduled-posts) are added to `JobScheduler` by ADR-0008
 * Phases 3/4; this phase lands first, so we invoke whichever are present and
 * clearly defer the rest. Kept defensive (no import of not-yet-existing modules)
 * so the bundle keeps building.
 */
async function syncRepeatableJobs(): Promise<void> {
  const scheduler = jobScheduler as unknown as Record<string, unknown>
  // Preferred umbrella method first, then the specific ones a sibling phase may add.
  const candidates = [
    'syncRepeatableJobs',
    'syncClientReportSchedules',
    'scheduleReconcileScheduledPosts',
  ]

  const ran: string[] = []
  for (const name of candidates) {
    const fn = scheduler[name]
    if (typeof fn === 'function') {
      await (fn as (...a: unknown[]) => unknown).call(jobScheduler)
      ran.push(name)
    }
  }

  if (ran.length > 0) {
    BusinessLogger.logSystemEvent('worker_repeatable_synced', { methods: ran })
  } else {
    // TODO(ADR-0008 Phase 3/4): once JobScheduler exposes client-report schedule
    // sync + a `reconcile-scheduled-posts` repeatable, they are picked up here
    // automatically via the candidate list above.
    BusinessLogger.logSystemEvent('worker_repeatable_sync_deferred', {
      reason: 'JobScheduler repeatable-sync methods not yet present (ADR-0008 Phase 3/4)',
    })
  }
}

function logBanner(): void {
  const conn = buildRedisConnectionOptions()
  const redisTarget = `${conn.host}:${conn.port}${conn.db ? `/${conn.db}` : ''}`
  const lines = [
    '──────────────────────────────────────────────',
    ' SociallyHub background worker (ADR-0008)',
    `  pid:         ${process.pid}`,
    `  node env:    ${process.env.NODE_ENV || 'development'}`,
    `  redis:       ${redisTarget}`,
    `  queues:      ${HOSTED_QUEUES.join(', ')}`,
    `  heartbeat:   ${HEARTBEAT_KEY} (EX ${HEARTBEAT_TTL_SECONDS}s)`,
    '──────────────────────────────────────────────',
  ]
  // Plain console for human-readable docker logs; structured event for log pipelines.
  console.log(lines.join('\n'))
  BusinessLogger.logSystemEvent('worker_boot', {
    pid: process.pid,
    queues: HOSTED_QUEUES,
    redis: redisTarget,
  })
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  console.log(`[worker] ${signal} received — shutting down gracefully...`)
  BusinessLogger.logSystemEvent('worker_shutdown_start', { signal })

  const force = setTimeout(() => {
    console.error('[worker] graceful shutdown timed out — forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS)
  force.unref()

  try {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (heartbeatRedis) {
      try {
        await heartbeatRedis.del(HEARTBEAT_KEY)
      } catch {
        /* best effort — the key TTL-expires anyway */
      }
      await heartbeatRedis.quit().catch(() => {})
      heartbeatRedis = null
    }

    // Closes workers -> queue events -> queues -> shared redis, in order.
    await queueManager.shutdown()
    await prisma.$disconnect().catch(() => {})

    clearTimeout(force)
    BusinessLogger.logSystemEvent('worker_shutdown_complete', { signal })
    console.log('[worker] shutdown complete')
    process.exit(0)
  } catch (err) {
    ErrorLogger.logUnexpectedError(err as Error, { context: 'worker_shutdown', signal })
    process.exit(1)
  }
}

function installSignalHandlers(): void {
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'))

  process.on('unhandledRejection', (reason) => {
    ErrorLogger.logUnexpectedError(
      reason instanceof Error ? reason : new Error(String(reason)),
      { context: 'worker_unhandled_rejection' },
    )
  })
  process.on('uncaughtException', (err) => {
    ErrorLogger.logUnexpectedError(err, { context: 'worker_uncaught_exception' })
    void gracefulShutdown('uncaughtException')
  })
}

async function main(): Promise<void> {
  logBanner()

  await checkDatabase()

  // Single registration authority (ADR-0008 Phase 1): registers all processors
  // by (queueName, jobName) and creates a worker per queue that has one.
  await jobScheduler.initialize()

  await syncRepeatableJobs()

  await startHeartbeat()
  installSignalHandlers()

  console.log('[worker] ready — processing jobs')
  BusinessLogger.logSystemEvent('worker_ready', { queues: HOSTED_QUEUES })
}

main().catch((err) => {
  ErrorLogger.logUnexpectedError(err as Error, { context: 'worker_bootstrap' })
  console.error('[worker] fatal bootstrap error:', err)
  process.exit(1)
})
