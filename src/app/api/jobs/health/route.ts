import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/jobs/queue-manager'
import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'
import { withLogging } from '@/lib/middleware/logging'

async function getHandler(request: NextRequest) {
  try {
    // Get statistics for health analysis
    const allStats = await queueManager.getAllQueueStats()
    
    const queueHealth = Object.entries(allStats).map(([queueName, counts]) => {
      const totalJobs = counts.waiting + counts.active + counts.completed + counts.failed + counts.delayed
      const errorRate = totalJobs > 0 ? (counts.failed / totalJobs) * 100 : 0
      const backlogSize = counts.waiting + counts.delayed
      
      // Calculate mock metrics (in real implementation, these would come from job history)
      const throughput = Math.random() * 50 + 10 // 10-60 jobs per minute
      const avgDuration = Math.random() * 5000 + 500 // 500-5500ms
      
      // Health analysis
      const issues: string[] = []
      const recommendations: string[] = []
      
      if (errorRate > 10) {
        issues.push(`High error rate: ${errorRate.toFixed(1)}%`)
        recommendations.push('Review failed jobs and fix underlying issues')
      }
      
      if (backlogSize > 100) {
        issues.push(`Large backlog: ${backlogSize} jobs pending`)
        recommendations.push('Consider increasing worker concurrency')
      }
      
      if (avgDuration > 10000) {
        issues.push(`Slow processing: ${avgDuration.toFixed(0)}ms average`)
        recommendations.push('Optimize job processing logic')
      }
      
      if (counts.active === 0 && counts.waiting > 0) {
        issues.push('Jobs waiting but no active workers')
        recommendations.push('Check if workers are running and healthy')
      }
      
      if (counts.paused > 0) {
        issues.push(`Queue is paused: ${counts.paused} jobs`)
        recommendations.push('Resume queue if pause was unintentional')
      }
      
      // Add proactive recommendations
      if (throughput > 40 && backlogSize < 10) {
        recommendations.push('Queue is performing well - consider it for handling more load')
      }
      
      if (errorRate < 1 && avgDuration < 2000) {
        recommendations.push('Excellent performance - this queue can serve as a benchmark')
      }
      
      return {
        queueName,
        isHealthy: issues.length === 0,
        issues,
        recommendations,
        metrics: {
          throughput: Math.round(throughput * 10) / 10,
          errorRate: Math.round(errorRate * 10) / 10,
          avgDuration: Math.round(avgDuration),
          backlogSize
        }
      }
    })

    BusinessLogger.logSystemEvent('queue_health_requested', {
      queuesCount: queueHealth.length,
      healthyQueues: queueHealth.filter(q => q.isHealthy).length,
      issuesDetected: queueHealth.reduce((acc, q) => acc + q.issues.length, 0),
      userAgent: request.headers.get('user-agent')
    })

    return NextResponse.json(queueHealth)

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'queue_health_api',
      operation: 'get_health'
    })

    return NextResponse.json(
      { error: 'Failed to fetch queue health' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'queue-health')