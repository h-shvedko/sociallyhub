import { NextRequest, NextResponse } from 'next/server'
import type { Job } from 'bullmq'

import { BusinessLogger, ErrorLogger } from '@/lib/middleware/logging'
import { withLogging } from '@/lib/middleware/logging'
import { jsonError } from '@/lib/api/respond'
import {
  KNOWN_QUEUE_NAMES,
  MONITORED_JOB_STATES,
  getMonitoringQueue,
  isKnownQueue,
  isMonitoredState,
  type MonitoredJobState,
} from '@/lib/jobs/queue-handles'

/** Hard cap on how many jobs we pull per (queue, state) to bound Redis work. */
const MAX_FETCH_PER_BUCKET = 200

interface JobDetails {
  id: string
  name: string
  queueName: string
  status: MonitoredJobState
  progress: number
  data: unknown
  createdAt: string
  processedAt?: string
  finishedAt?: string
  failedReason?: string
  attempts: number
  maxAttempts: number
  delay?: number
  priority: number
  duration?: number
  returnValue?: unknown
}

/** Map a BullMQ Job (known to be in `state`) to the UI's JobDetails shape. */
function toDetails(job: Job, queueName: string, state: MonitoredJobState): JobDetails {
  const processedAt =
    typeof job.processedOn === 'number' ? new Date(job.processedOn).toISOString() : undefined
  const finishedAt =
    typeof job.finishedOn === 'number' ? new Date(job.finishedOn).toISOString() : undefined
  const duration =
    typeof job.processedOn === 'number' &&
    typeof job.finishedOn === 'number' &&
    job.finishedOn >= job.processedOn
      ? job.finishedOn - job.processedOn
      : undefined

  return {
    id: String(job.id ?? ''),
    name: job.name,
    queueName,
    status: state,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    data: job.data,
    createdAt: new Date(job.timestamp).toISOString(),
    processedAt,
    finishedAt,
    failedReason: job.failedReason || undefined,
    attempts: job.attemptsMade ?? 0,
    maxAttempts: typeof job.opts?.attempts === 'number' ? job.opts.attempts : 1,
    delay: job.delay || undefined,
    priority: job.priority ?? 0,
    duration,
    returnValue: job.returnvalue ?? undefined,
  }
}

/**
 * Real background-job listing (ADR-0008, Phase 5).
 *
 * The former `mockJobs` array is deleted. This reads actual jobs from Redis via
 * Queue handles, tagging each with the state bucket it was fetched from, then
 * applies the same queue/status/search filters + pagination the UI expects.
 * The result is genuine (and may legitimately be empty).
 */
async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queueParam = searchParams.get('queue')
    const statusParam = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)

    // Resolve which queues/states to query. An explicit-but-unknown filter value
    // yields an empty set (honest: we do not monitor it) rather than an error.
    const queueNames: readonly string[] =
      queueParam && queueParam !== 'all'
        ? isKnownQueue(queueParam)
          ? [queueParam]
          : []
        : KNOWN_QUEUE_NAMES

    const states: readonly MonitoredJobState[] =
      statusParam && statusParam !== 'all'
        ? isMonitoredState(statusParam)
          ? [statusParam]
          : []
        : MONITORED_JOB_STATES

    // Bound the per-bucket fetch to what pagination could possibly need.
    const fetchEnd = Math.min(offset + limit, MAX_FETCH_PER_BUCKET) - 1

    const collected: JobDetails[] = []
    for (const queueName of queueNames) {
      const queue = getMonitoringQueue(queueName)
      for (const state of states) {
        const jobs = (await queue.getJobs([state], 0, fetchEnd)) as Job[]
        for (const job of jobs) {
          if (job) collected.push(toDetails(job, queueName, state))
        }
      }
    }

    let filtered = collected
    if (search) {
      const term = search.toLowerCase()
      filtered = filtered.filter(
        (job) =>
          job.name.toLowerCase().includes(term) || job.id.toLowerCase().includes(term)
      )
    }

    // Newest first, then paginate the combined set.
    filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const paginatedJobs = filtered.slice(offset, offset + limit)

    BusinessLogger.logSystemEvent('job_details_requested', {
      filters: { queue: queueParam, status: statusParam, search },
      totalJobs: filtered.length,
      returnedJobs: paginatedJobs.length,
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json(paginatedJobs)
  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'job_details_api',
      operation: 'get_details',
    })

    return jsonError(500, 'Failed to fetch job details', {
      code: 'JOB_DETAILS_UNAVAILABLE',
    })
  }
}

export const GET = withLogging(getHandler, 'job-details')
