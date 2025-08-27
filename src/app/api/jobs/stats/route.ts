import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/jobs/queue-manager'
import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'
import { withLogging } from '@/lib/middleware/logging'

async function getHandler(request: NextRequest) {
  try {
    // Get statistics for all queues
    const allStats = await queueManager.getAllQueueStats()
    
    // Transform to expected format
    const stats = Object.entries(allStats).map(([queueName, counts]) => ({
      queueName,
      ...counts
    }))

    BusinessLogger.logSystemEvent('job_stats_requested', {
      queuesCount: stats.length,
      userAgent: request.headers.get('user-agent')
    })

    return NextResponse.json(stats)

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'job_stats_api',
      operation: 'get_stats'
    })

    return NextResponse.json(
      { error: 'Failed to fetch job statistics' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'job-stats')