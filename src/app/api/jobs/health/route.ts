import { NextRequest, NextResponse } from 'next/server'
import type { Job } from 'bullmq'

import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'
import { withLogging } from '@/lib/middleware/logging'
import { jsonError } from '@/lib/api/respond'
import { KNOWN_QUEUE_NAMES, getMonitoringQueue } from '@/lib/jobs/queue-handles'

/** How many recent completed jobs to sample when deriving duration/throughput. */
const COMPLETED_SAMPLE_SIZE = 50
/** Window for the "jobs completed per minute" throughput figure. */
const THROUGHPUT_WINDOW_MS = 60_000

/**
 * Per-queue health from REAL Redis state (ADR-0008, Phase 5).
 *
 * The former implementation fabricated `throughput` and `avgDuration` with
 * `Math.random()`; those are deleted. What remains is derived from real data:
 *  - counts come from `getJobCounts` against Redis;
 *  - `errorRate` and `backlogSize` are computed from those counts;
 *  - `avgDuration` and `throughput` are measured from the timestamps of recently
 *    completed jobs (`processedOn`/`finishedOn`). These are a bounded sample
 *    (last ~50 retained completed jobs; retention is capped by `removeOnComplete`)
 *    — an honest recent-window estimate, not a fabricated number. ADR-0023
 *    replaces this with continuous metric collection.
 *
 * Response shape (`QueueHealth[]`) is preserved for the monitoring dashboard.
 */
async function getHandler(request: NextRequest) {
  try {
    const queueHealth = await Promise.all(
      KNOWN_QUEUE_NAMES.map(async (queueName) => {
        const queue = getMonitoringQueue(queueName)

        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused'
        )
        const waiting = counts.waiting ?? 0
        const active = counts.active ?? 0
        const completed = counts.completed ?? 0
        const failed = counts.failed ?? 0
        const delayed = counts.delayed ?? 0
        const paused = counts.paused ?? 0

        const totalRetained = waiting + active + completed + failed + delayed
        // Error rate over currently-retained jobs. Completed retention is capped
        // by `removeOnComplete`, so this is a recent-window estimate, not lifetime.
        const errorRate = totalRetained > 0 ? (failed / totalRetained) * 100 : 0
        const backlogSize = waiting + delayed

        // Sample recent completed jobs to measure real duration + throughput.
        let avgDuration = 0
        let throughput = 0
        const sample = (await queue.getJobs(
          ['completed'],
          0,
          COMPLETED_SAMPLE_SIZE - 1
        )) as Job[]
        if (sample.length > 0) {
          const now = Date.now()
          const durations: number[] = []
          let completedInWindow = 0
          for (const job of sample) {
            if (
              typeof job.processedOn === 'number' &&
              typeof job.finishedOn === 'number' &&
              job.finishedOn >= job.processedOn
            ) {
              durations.push(job.finishedOn - job.processedOn)
            }
            if (
              typeof job.finishedOn === 'number' &&
              now - job.finishedOn <= THROUGHPUT_WINDOW_MS
            ) {
              completedInWindow += 1
            }
          }
          if (durations.length > 0) {
            avgDuration = Math.round(
              durations.reduce((a, b) => a + b, 0) / durations.length
            )
          }
          // Jobs completed in the last minute (per-minute rate over the window).
          throughput = completedInWindow
        }

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
          issues.push(`Slow processing: ${avgDuration}ms average`)
          recommendations.push('Optimize job processing logic')
        }

        // The most useful real signal: work is queued but nothing is draining it
        // — usually means the worker process (src/worker.ts) is down.
        if (active === 0 && waiting > 0) {
          issues.push('Jobs waiting but none active')
          recommendations.push(
            'Check that the background worker is running (see /api/health worker status)'
          )
        }

        if (paused > 0) {
          issues.push(`Queue is paused: ${paused} jobs`)
          recommendations.push('Resume queue if the pause was unintentional')
        }

        return {
          queueName,
          isHealthy: issues.length === 0,
          issues,
          recommendations,
          metrics: {
            // Real: jobs completed in the last minute (bounded by sample size).
            throughput,
            errorRate: Math.round(errorRate * 10) / 10,
            // Real: mean processing time of sampled completed jobs, in ms.
            avgDuration,
            backlogSize,
          },
        }
      })
    )

    BusinessLogger.logSystemEvent('queue_health_requested', {
      queuesCount: queueHealth.length,
      healthyQueues: queueHealth.filter((q) => q.isHealthy).length,
      issuesDetected: queueHealth.reduce((acc, q) => acc + q.issues.length, 0),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json(queueHealth)
  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'queue_health_api',
      operation: 'get_health',
    })

    return jsonError(500, 'Failed to fetch queue health', {
      code: 'QUEUE_HEALTH_UNAVAILABLE',
    })
  }
}

export const GET = withLogging(getHandler, 'queue-health')
