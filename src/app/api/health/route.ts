import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

import { isEncryptionConfigured } from '@/lib/encryption'

const prisma = new PrismaClient()

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

    // Check Redis connection
    const redisStart = Date.now()
    try {
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      await redis.ping()
      await redis.disconnect()
      healthCheck.services.redis.status = 'healthy'
      healthCheck.services.redis.responseTime = Date.now() - redisStart
    } catch (error) {
      healthCheck.services.redis.status = 'unhealthy'
      healthCheck.services.redis.responseTime = Date.now() - redisStart
      healthCheck.status = 'degraded'
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