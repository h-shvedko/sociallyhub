import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()

// Simple metrics collector
class MetricsCollector {
  private metrics: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()

  increment(name: string, value = 1) {
    const current = this.metrics.get(name) || 0
    this.metrics.set(name, current + value)
  }

  gauge(name: string, value: number) {
    this.metrics.set(name, value)
  }

  histogram(name: string, value: number) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, [])
    }
    this.histograms.get(name)!.push(value)
  }

  getMetrics() {
    return {
      counters: Object.fromEntries(this.metrics),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, values]) => [
          name,
          {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
          }
        ])
      )
    }
  }

  toPrometheus() {
    let output = ''
    
    // Counter metrics
    for (const [name, value] of this.metrics) {
      output += `# TYPE ${name} counter\n`
      output += `${name} ${value}\n`
    }
    
    // Histogram metrics
    for (const [name, values] of this.histograms) {
      const sum = values.reduce((a, b) => a + b, 0)
      const count = values.length
      
      output += `# TYPE ${name} histogram\n`
      output += `${name}_count ${count}\n`
      output += `${name}_sum ${sum}\n`
      
      if (count > 0) {
        const sorted = values.sort((a, b) => a - b)
        const percentiles = [0.5, 0.95, 0.99]
        
        for (const p of percentiles) {
          const index = Math.ceil(count * p) - 1
          const value = sorted[Math.max(0, index)]
          output += `${name}_bucket{le="${p}"} ${value}\n`
        }
      }
    }
    
    return output
  }
}

export async function GET(request: NextRequest) {
  const start = Date.now()
  const collector = new MetricsCollector()

  try {
    // System metrics
    const memoryUsage = process.memoryUsage()
    collector.gauge('nodejs_memory_heap_used_bytes', memoryUsage.heapUsed)
    collector.gauge('nodejs_memory_heap_total_bytes', memoryUsage.heapTotal)
    collector.gauge('nodejs_memory_external_bytes', memoryUsage.external)
    collector.gauge('nodejs_memory_rss_bytes', memoryUsage.rss)
    collector.gauge('nodejs_process_uptime_seconds', process.uptime())

    // CPU usage
    const cpuUsage = process.cpuUsage()
    collector.gauge('nodejs_cpu_user_seconds_total', cpuUsage.user / 1000000)
    collector.gauge('nodejs_cpu_system_seconds_total', cpuUsage.system / 1000000)

    // Event loop lag (approximation)
    const eventLoopStart = process.hrtime.bigint()
    await new Promise(resolve => setImmediate(resolve))
    const eventLoopEnd = process.hrtime.bigint()
    const eventLoopLag = Number(eventLoopEnd - eventLoopStart) / 1000000 // Convert to milliseconds
    collector.histogram('nodejs_eventloop_lag_milliseconds', eventLoopLag)

    // Database metrics
    try {
      const dbStart = Date.now()
      
      // Get database stats
      const userCount = await prisma.user.count()
      const postCount = await prisma.post.count()
      const workspaceCount = await prisma.workspace.count()
      
      const dbEnd = Date.now()
      
      collector.gauge('sociallyhub_users_total', userCount)
      collector.gauge('sociallyhub_posts_total', postCount)
      collector.gauge('sociallyhub_workspaces_total', workspaceCount)
      collector.histogram('database_query_duration_milliseconds', dbEnd - dbStart)
      collector.increment('database_queries_total')
      
      // Recent activity metrics
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const postsToday = await prisma.post.count({
        where: {
          createdAt: {
            gte: today
          }
        }
      })
      
      collector.gauge('sociallyhub_posts_today', postsToday)
      
    } catch (dbError) {
      collector.increment('database_errors_total')
    }

    // Redis metrics
    try {
      const redisStart = Date.now()
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
      
      const redisInfo = await redis.info('memory')
      const redisMemoryMatch = redisInfo.match(/used_memory:(\d+)/)
      if (redisMemoryMatch) {
        collector.gauge('redis_memory_used_bytes', parseInt(redisMemoryMatch[1]))
      }
      
      const redisConnectedClients = await redis.info('clients')
      const clientsMatch = redisConnectedClients.match(/connected_clients:(\d+)/)
      if (clientsMatch) {
        collector.gauge('redis_connected_clients', parseInt(clientsMatch[1]))
      }
      
      await redis.disconnect()
      
      const redisEnd = Date.now()
      collector.histogram('redis_query_duration_milliseconds', redisEnd - redisStart)
      collector.increment('redis_queries_total')
      
    } catch (redisError) {
      collector.increment('redis_errors_total')
    }

    // Application-specific metrics
    collector.increment('http_requests_total')
    collector.gauge('sociallyhub_version', 1)
    
    // Response time
    const responseTime = Date.now() - start
    collector.histogram('http_request_duration_milliseconds', responseTime)

    // Check Accept header for format
    const acceptHeader = request.headers.get('accept') || ''
    
    if (acceptHeader.includes('text/plain') || request.nextUrl.searchParams.get('format') === 'prometheus') {
      // Return Prometheus format
      return new NextResponse(collector.toPrometheus(), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      })
    } else {
      // Return JSON format
      return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        metrics: collector.getMetrics(),
        responseTime: `${responseTime}ms`
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      })
    }

  } catch (error) {
    console.error('Metrics collection failed:', error)
    
    collector.increment('metrics_errors_total')
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to collect metrics',
      responseTime: `${Date.now() - start}ms`
    }, { status: 500 })
    
  } finally {
    await prisma.$disconnect()
  }
}