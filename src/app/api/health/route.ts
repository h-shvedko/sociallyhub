import { NextRequest, NextResponse } from 'next/server'
import Redis from 'ioredis'

import { isEncryptionConfigured } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { buildRedisConnectionOptions } from '@/lib/jobs/queue-manager'

/**
 * Readiness health check (ADR-0023 item 5).
 *
 * Real dependency checks over the SHARED singletons — never a per-request
 * `new PrismaClient()` or a fresh Redis connection per scrape:
 *   - database:   `SELECT 1` via the singleton `prisma` (@/lib/prisma).
 *   - redis:      PING via a module-scope shared ioredis client (below).
 *   - encryption: ENCRYPTION_KEY presence/shape (ADR-0006), never decrypts.
 *   - worker:     freshness of the `worker:heartbeat` Redis key written by
 *                 src/worker.ts (ADR-0008), gated by WORKER_EXPECTED.
 *
 * The misleading `process.cwd()/tmp` filesystem write test was removed: it is
 * meaningless in a mostly-read-only standalone container, and a real
 * uploads-volume writability check belongs to ADR-0007.
 *
 * Degradation policy: a down non-critical dependency (redis, worker,
 * encryption) DEGRADES the report but returns HTTP 200 — deploy/liveness probes
 * read the body (ADR-0022). Only a DOWN DATABASE returns HTTP 503.
 *
 * Overall `status` vocabulary is kept backward-compatible with the ADR-0022
 * deploy gate (which greps `"status":"healthy"`) and docs/ops/deployment.md:
 * 'healthy' | 'degraded' | 'unhealthy'.
 */

/**
 * Redis key written by the background worker (src/worker.ts, ADR-0008) as a
 * millisecond epoch, `EX 60s`, refreshed ~every 20s. Considered fresh (worker
 * alive) if younger than MAX_AGE. A missing/expired key means the worker is
 * down. MAX_AGE tolerates one missed refresh tick.
 */
const WORKER_HEARTBEAT_KEY = 'worker:heartbeat'
const WORKER_HEARTBEAT_MAX_AGE_MS = 90_000
const REDIS_PING_TIMEOUT_MS = 3_000

// --- Shared, module-scope Redis client (ADR-0023 item 5) -------------------
//
// Created lazily ONCE and reused across requests (never per-request).
//   - `lazyConnect`: merely importing this route never opens a socket (nor
//     throws at build/import); the connection is established on the first PING.
//   - `error` handler: a Redis outage surfaces as a reported status, never as
//     an unhandled-rejection crash.
//   - `maxRetriesPerRequest: 1`: a PING issued while Redis is down is rejected
//     after one retry cycle instead of pending indefinitely.
//   - DEFAULT retryStrategy (exponential backoff, never gives up) is kept so the
//     long-lived shared client SELF-HEALS when Redis recovers — a `() => null`
//     strategy would leave it permanently dead after the first blip.
// NOTE: `enableOfflineQueue` is intentionally left at its default (true). With
// `lazyConnect`, the very first PING is issued before the socket is ready;
// `enableOfflineQueue: false` would reject that first PING immediately and report
// a FALSE "unhealthy" on cold start even when Redis is up. Queueing it until
// ready (bounded by `maxRetriesPerRequest` and the timeout below) is correct for
// a health probe. `pingRedis()` caps the wait regardless.
let redisClient: Redis | null = null

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      ...buildRedisConnectionOptions(),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: REDIS_PING_TIMEOUT_MS,
    })
    // Swallow connection errors: the PING attempt below reports the true status.
    redisClient.on('error', () => {})
  }
  return redisClient
}

/** PING with a hard upper bound so the health endpoint latency stays bounded. */
async function pingRedis(redis: Redis): Promise<void> {
  await Promise.race([
    redis.ping(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('redis ping timeout')),
        REDIS_PING_TIMEOUT_MS
      )
    ),
  ])
}

type ServiceStatus = 'healthy' | 'unhealthy'
type WorkerStatus = 'healthy' | 'down' | 'disabled'

export async function GET(_request: NextRequest) {
  const start = Date.now()

  const workerExpected = process.env.WORKER_EXPECTED === 'true'

  const healthCheck = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: { status: 'unhealthy' as ServiceStatus, responseTime: 0 },
      redis: { status: 'unhealthy' as ServiceStatus, responseTime: 0 },
      // ADR-0006: encryption config check (presence + shape only, never decrypts
      // or exposes key material). Values: 'ok' | 'misconfigured'.
      encryption: { status: 'ok' as 'ok' | 'misconfigured' },
      // ADR-0008/0023: background worker liveness via the Redis heartbeat key.
      // 'disabled' unless WORKER_EXPECTED=true (health stays green until the
      // worker is actually expected). When expected: 'healthy' (fresh) | 'down'.
      worker: {
        status: 'disabled' as WorkerStatus,
        lastHeartbeatAgeSeconds: null as number | null,
      },
    },
    metrics: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
    responseTime: 0,
  }

  // --- Database (the only critical dependency) ------------------------------
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    healthCheck.services.database.status = 'healthy'
  } catch {
    healthCheck.services.database.status = 'unhealthy'
  }
  healthCheck.services.database.responseTime = Date.now() - dbStart

  // --- Redis + worker heartbeat (same shared connection) --------------------
  const redisStart = Date.now()
  let redisHealthy = false
  try {
    const redis = getRedis()
    await pingRedis(redis)
    redisHealthy = true
    healthCheck.services.redis.status = 'healthy'
    healthCheck.services.redis.responseTime = Date.now() - redisStart

    // Worker liveness only matters when a worker is expected to be running.
    if (workerExpected) {
      try {
        const raw = await redis.get(WORKER_HEARTBEAT_KEY)
        if (raw) {
          const ts = parseInt(raw, 10)
          const ageMs = Number.isFinite(ts)
            ? Date.now() - ts
            : Number.POSITIVE_INFINITY
          healthCheck.services.worker.lastHeartbeatAgeSeconds = Number.isFinite(
            ageMs
          )
            ? Math.round(ageMs / 1000)
            : null
          healthCheck.services.worker.status =
            ageMs >= 0 && ageMs < WORKER_HEARTBEAT_MAX_AGE_MS
              ? 'healthy'
              : 'down'
        } else {
          healthCheck.services.worker.status = 'down'
        }
      } catch {
        // Redis reachable but the heartbeat read failed — cannot confirm alive.
        healthCheck.services.worker.status = 'down'
      }
    }
  } catch {
    healthCheck.services.redis.status = 'unhealthy'
    healthCheck.services.redis.responseTime = Date.now() - redisStart
    // Redis unreachable => worker liveness is indeterminate. When a worker is
    // expected we cannot confirm it is alive, so report 'down'; otherwise the
    // worker check stays 'disabled' and does not affect overall status.
    if (workerExpected) {
      healthCheck.services.worker.status = 'down'
    }
  }

  // --- Encryption config (ADR-0006) -----------------------------------------
  try {
    healthCheck.services.encryption.status = isEncryptionConfigured()
      ? 'ok'
      : 'misconfigured'
  } catch {
    healthCheck.services.encryption.status = 'misconfigured'
  }

  // --- Overall status -------------------------------------------------------
  // Only the DATABASE is critical (503). Redis/worker/encryption problems
  // DEGRADE (HTTP 200) so deploy/liveness probes still read the body.
  if (healthCheck.services.database.status !== 'healthy') {
    healthCheck.status = 'unhealthy'
  } else {
    const degraded =
      healthCheck.services.redis.status !== 'healthy' ||
      healthCheck.services.encryption.status !== 'ok' ||
      (workerExpected && healthCheck.services.worker.status !== 'healthy')
    healthCheck.status = degraded ? 'degraded' : 'healthy'
  }

  healthCheck.responseTime = Date.now() - start

  // 503 ONLY when the database is down; 200 for healthy AND degraded.
  const httpStatus =
    healthCheck.services.database.status === 'healthy' ? 200 : 503

  return NextResponse.json(healthCheck, { status: httpStatus })
}

/**
 * HEAD — cheap liveness probe. Confirms the process can reach the DB without
 * building the full readiness payload. Uses the shared singleton `prisma`.
 */
export async function HEAD(_request: NextRequest) {
  try {
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}
