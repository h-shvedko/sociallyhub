import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

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