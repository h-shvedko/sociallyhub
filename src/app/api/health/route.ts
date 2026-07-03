import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

import { isEncryptionConfigured } from '@/lib/encryption'

const prisma = new PrismaClient()

/**
 * Redis key written by the background worker (src/worker.ts, ADR-0008) with a
 * 60s TTL, refreshed ~every 20s. Considered fresh (worker alive) if younger than
 * this. A missing/expired key means the worker is down.
 */
const WORKER_HEARTBEAT_KEY = 'worker:heartbeat'
const WORKER_HEARTBEAT_MAX_AGE_MS = 90_000

export async function GET(request: NextRequest) {
  const start = Date.now()
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: { status: 'unknown', responseTime: 0 },
      redis: { status: 'unknown', responseTime: 0 },
      filesystem: { status: 'unknown', responseTime: 0 },
      // ADR-0006: encryption config check (presence + shape only, never decrypts
      // or exposes key material). Values: 'ok' | 'misconfigured' | 'unknown'.
      encryption: { status: 'unknown' },
      // ADR-0008: background worker liveness via the Redis heartbeat key.
      // Values: 'ok' | 'down' | 'unknown'. A down worker DEGRADES health but
      // never 500s the endpoint (publishing is impacted, the API is not).
      worker: { status: 'unknown', lastHeartbeatAgeSeconds: null as number | null },
    },
    metrics: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
    responseTime: 0,
  }

  try {
    // Check database connection
    const dbStart = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      healthCheck.services.database.status = 'healthy'
      healthCheck.services.database.responseTime = Date.now() - dbStart
    } catch (error) {
      healthCheck.services.database.status = 'unhealthy'
      healthCheck.services.database.responseTime = Date.now() - dbStart
      healthCheck.status = 'degraded'
    }

    // Check Redis connection AND worker liveness (ADR-0008). The worker
    // heartbeat lives in Redis, so we read it on the same connection.
    const redisStart = Date.now()
    let redis: Redis | null = null
    try {
      redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        connectTimeout: 5000,
      })
      await redis.ping()
      healthCheck.services.redis.status = 'healthy'
      healthCheck.services.redis.responseTime = Date.now() - redisStart

      // Worker liveness: fresh heartbeat key => the background worker is alive.
      try {
        const raw = await redis.get(WORKER_HEARTBEAT_KEY)
        if (raw) {
          const ts = parseInt(raw, 10)
          const ageMs = Number.isFinite(ts) ? Date.now() - ts : Number.POSITIVE_INFINITY
          healthCheck.services.worker.lastHeartbeatAgeSeconds = Number.isFinite(ageMs)
            ? Math.round(ageMs / 1000)
            : null
          healthCheck.services.worker.status =
            ageMs >= 0 && ageMs < WORKER_HEARTBEAT_MAX_AGE_MS ? 'ok' : 'down'
        } else {
          healthCheck.services.worker.status = 'down'
        }
      } catch {
        // Redis reachable but heartbeat read failed — we cannot tell.
        healthCheck.services.worker.status = 'unknown'
      }
    } catch (error) {
      healthCheck.services.redis.status = 'unhealthy'
      healthCheck.services.redis.responseTime = Date.now() - redisStart
      healthCheck.status = 'degraded'
      // Redis unreachable => worker liveness is indeterminate, not "down".
      healthCheck.services.worker.status = 'unknown'
    } finally {
      if (redis) {
        try {
          await redis.quit()
        } catch {
          redis.disconnect()
        }
      }
    }

    // Check filesystem (write/read test)
    const fsStart = Date.now()
    try {
      const fs = require('fs')
      const path = require('path')
      const testFile = path.join(process.cwd(), 'tmp', 'health-check')
      
      // Ensure tmp directory exists
      const tmpDir = path.dirname(testFile)
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true })
      }
      
      // Write and read test
      fs.writeFileSync(testFile, 'health-check')
      fs.readFileSync(testFile, 'utf8')
      fs.unlinkSync(testFile)
      
      healthCheck.services.filesystem.status = 'healthy'
      healthCheck.services.filesystem.responseTime = Date.now() - fsStart
    } catch (error) {
      healthCheck.services.filesystem.status = 'unhealthy'
      healthCheck.services.filesystem.responseTime = Date.now() - fsStart
      healthCheck.status = 'degraded'
    }

    // Check encryption configuration (ADR-0006): presence + shape of
    // ENCRYPTION_KEY only. No decrypt, no key material in the payload/logs.
    try {
      healthCheck.services.encryption.status = isEncryptionConfigured()
        ? 'ok'
        : 'misconfigured'
    } catch {
      healthCheck.services.encryption.status = 'misconfigured'
    }

    // Calculate total response time
    healthCheck.responseTime = Date.now() - start

    // Determine overall status
    const unhealthyServices = Object.values(healthCheck.services)
      .filter(service => service.status === 'unhealthy').length

    if (unhealthyServices === 0) {
      healthCheck.status = 'healthy'
    } else if (unhealthyServices >= 2) {
      healthCheck.status = 'unhealthy'
    } else {
      healthCheck.status = 'degraded'
    }

    // ADR-0006: a misconfigured encryption key degrades health (it must NOT
    // 500 the endpoint). Only downgrade from 'healthy' — never mask a worse
    // status already set by failing services.
    if (
      healthCheck.services.encryption.status !== 'ok' &&
      healthCheck.status === 'healthy'
    ) {
      healthCheck.status = 'degraded'
    }

    // ADR-0008: a down/unknown worker degrades health (publishing is impacted)
    // but must NOT 500 the endpoint. Only downgrade from 'healthy' — never mask
    // a worse status already set by a failing service.
    if (
      healthCheck.services.worker.status !== 'ok' &&
      healthCheck.status === 'healthy'
    ) {
      healthCheck.status = 'degraded'
    }

    // Return appropriate HTTP status
    const httpStatus = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503

    return NextResponse.json(healthCheck, { status: httpStatus })

  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      responseTime: Date.now() - start,
    }, { status: 503 })
    
  } finally {
    await prisma.$disconnect()
  }
}

// Also support HEAD requests for simple health checks
export async function HEAD(request: NextRequest) {
  try {
    // Simple connectivity check without detailed response
    await prisma.$queryRaw`SELECT 1`
    return new NextResponse(null, { status: 200 })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  } finally {
    await prisma.$disconnect()
  }
}