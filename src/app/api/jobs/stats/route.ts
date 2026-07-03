import { NextRequest, NextResponse } from 'next/server'

import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'
import { withLogging } from '@/lib/middleware/logging'
import { jsonError } from '@/lib/api/respond'
import { KNOWN_QUEUE_NAMES, getMonitoringQueue } from '@/lib/jobs/queue-handles'

/**
 * Real per-queue job counts (ADR-0008, Phase 5).
 *
 * Reads actual Redis state through lightweight Queue handles for the known
 * queue names — NOT `queueManager.getAllQueueStats()`, whose in-process `queues`
 * Map is always empty in the web process (workers live in `src/worker.ts`).
 *
 * Response shape is preserved for the monitoring dashboard: an array of
 * `{ queueName, waiting, active, completed, failed, delayed, paused }`.
 */
async function getHandler(request: NextRequest) {
  try {
    const stats = await Promise.all(
      KNOWN_QUEUE_NAMES.map(async (queueName) => {
        const counts = await getMonitoringQueue(queueName).getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused'
        )
        return {
          queueName,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          paused: counts.paused ?? 0,
        }
      })
    )

    BusinessLogger.logSystemEvent('job_stats_requested', {
      queuesCount: stats.length,
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json(stats)
  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'job_stats_api',
      operation: 'get_stats',
    })

    return jsonError(500, 'Failed to fetch job statistics', {
      code: 'JOB_STATS_UNAVAILABLE',
    })
  }
}

export const GET = withLogging(getHandler, 'job-stats')
