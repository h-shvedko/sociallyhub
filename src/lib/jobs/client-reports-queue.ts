/**
 * Client-report schedule queue helpers (ADR-0008, Phase 4).
 *
 * The single seam through which a `ClientReportSchedule` row becomes a BullMQ v5
 * repeatable job (the Job Schedulers API). Both the schedule CRUD routes and the
 * worker-boot full resync go through here, so the queue name, the processor's job
 * name, and — crucially — the deterministic scheduler id (derived from the row
 * id) are defined in exactly ONE place. Mirrors the Phase-3 `publish-queue.ts`
 * pattern: this module imports only `queueManager`, so a web route can wire up a
 * repeatable without pulling the (heavy) processor import graph into its bundle.
 *
 * A repeatable "job scheduler" fires the report-generation job on the cron
 * cadence derived from the schedule's frequency/time/day. The fired job carries
 * only `{ scheduleId }` — the processor loads the schedule, client, template, and
 * analytics from the DB (the DB is the source of truth).
 */
import { queueManager } from './queue-manager'

/** Queue the client-report processor consumes (registered in job-scheduler). */
export const CLIENT_REPORTS_QUEUE = 'client-reports'

/**
 * BullMQ job *name* the client-report processor is registered under:
 *   registerProcessor('client-reports', 'generate_client_report', clientReportsProcessor)
 * The repeatable's job template `name` and every one-off's `type` MUST equal this
 * or the fired job lands with no matching processor (the worker wrapper dispatches
 * on `job.name`).
 */
export const CLIENT_REPORT_JOB_NAME = 'generate_client_report'

/** Timing fields needed to compute the cron cadence + address the scheduler. */
export interface ClientReportScheduleTiming {
  id: string
  /** DAILY | WEEKLY | MONTHLY | QUARTERLY */
  frequency: string
  /** HH:MM (24h) */
  time: string
  /** 0=Sunday .. 6=Saturday (WEEKLY only) */
  dayOfWeek?: number | null
  /** 1..31 (MONTHLY / QUARTERLY) */
  dayOfMonth?: number | null
  /** Carried onto the job envelope for logging only. */
  workspaceId?: string
}

/**
 * Stable scheduler id derived from the schedule row id. Makes `upsertJobScheduler`
 * idempotent across worker boots (no duplicate timers) and makes the scheduler
 * addressable for `removeJobScheduler` on delete/pause.
 */
export function clientReportSchedulerId(scheduleId: string): string {
  return `client-report-schedule:${scheduleId}`
}

/**
 * Translate a schedule's frequency + time (+ day) into a BullMQ repeat cron
 * pattern (`m h dom mon dow`).
 *
 * QUARTERLY maps to the four quarter-start months (Jan/Apr/Jul/Oct) on the
 * configured day — cron has no native "every 3 months", so a fixed month list is
 * the honest, deterministic equivalent. Throws on a malformed `time` or an
 * unsupported `frequency`; callers upsert defensively so one bad row never aborts
 * the resync.
 */
export function clientReportCronPattern(schedule: ClientReportScheduleTiming): string {
  const [rawHour, rawMinute] = (schedule.time ?? '').split(':')
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid schedule time "${schedule.time}" (expected HH:MM)`)
  }

  switch (schedule.frequency) {
    case 'DAILY':
      return `${minute} ${hour} * * *`
    case 'WEEKLY':
      return `${minute} ${hour} * * ${schedule.dayOfWeek ?? 0}`
    case 'MONTHLY':
      return `${minute} ${hour} ${schedule.dayOfMonth ?? 1} * *`
    case 'QUARTERLY':
      return `${minute} ${hour} ${schedule.dayOfMonth ?? 1} 1,4,7,10 *`
    default:
      throw new Error(`Unsupported schedule frequency "${schedule.frequency}"`)
  }
}

/**
 * Create/replace the repeatable job scheduler for a schedule. Idempotent by
 * `clientReportSchedulerId` — a changed cadence (edited frequency/time/day)
 * replaces the old timer rather than stacking a second one. Throws on backend
 * failure so callers can decide (CRUD routes log + defer to the boot resync;
 * the resync logs per-row and continues).
 */
export async function upsertClientReportScheduler(
  schedule: ClientReportScheduleTiming
): Promise<void> {
  const queue = await queueManager.createQueue(CLIENT_REPORTS_QUEUE)
  const schedulerId = clientReportSchedulerId(schedule.id)
  const pattern = clientReportCronPattern(schedule)

  await queue.upsertJobScheduler(
    schedulerId,
    { pattern },
    {
      name: CLIENT_REPORT_JOB_NAME,
      data: {
        id: schedulerId,
        type: CLIENT_REPORT_JOB_NAME,
        payload: { scheduleId: schedule.id },
        userId: 'system',
        workspaceId: schedule.workspaceId,
        createdAt: new Date().toISOString(),
      },
      opts: {
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    }
  )
}

/** Remove a schedule's repeatable job scheduler (delete / pause). No-op if absent. */
export async function removeClientReportScheduler(scheduleId: string): Promise<void> {
  const queue = await queueManager.createQueue(CLIENT_REPORTS_QUEUE)
  await queue.removeJobScheduler(clientReportSchedulerId(scheduleId))
}

/**
 * Enqueue a one-off report-generation job (the manual "run now" trigger). Same
 * queue / job name / processor as the repeatable, so behavior is identical — it
 * just runs once, immediately. The timestamped jobId keeps a double-click from
 * stacking duplicates within the same millisecond while still allowing repeated
 * intentional runs.
 *
 * @returns the BullMQ jobId of the enqueued job.
 */
export async function enqueueClientReportRun(scheduleId: string): Promise<string> {
  const job = await queueManager.addJob(CLIENT_REPORTS_QUEUE, {
    id: `client-report-run:${scheduleId}:${Date.now()}`,
    type: CLIENT_REPORT_JOB_NAME,
    payload: { scheduleId },
    userId: 'system',
    createdAt: new Date().toISOString(),
  })
  return job.id as string
}
