import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { enqueueClientReportRun } from '@/lib/jobs/client-reports-queue'

/**
 * POST /api/client-reports/schedules/run — internal manual "run now" trigger.
 *
 * ADR-0008 Phase 4: scheduled report generation is now driven by BullMQ
 * repeatable job schedulers (synced from `ClientReportSchedule` on worker boot
 * and on schedule CRUD). This endpoint is retained ONLY as a manual trigger — it
 * ENQUEUES a one-off `generate_client_report` job (same queue/processor as the
 * repeatable) and returns immediately. It no longer generates reports inline and
 * no longer fabricates metrics (the old `Math.random()` mock is gone); the
 * processor aggregates real `AnalyticsMetric` data.
 *
 * Body (optional): `{ scheduleId }` — run one schedule now. Omitted → enqueue a
 * one-off for every currently-due active schedule (`nextRun <= now`), a cron
 * catch-up convenience.
 *
 * Auth (ADR-0005): shared-secret only, no session. The insecure
 * `'default-cron-secret'` fallback is REMOVED. `CRON_SECRET` must be configured
 * — if it is unset the route returns 500 (a server misconfiguration, distinct
 * from an unauthorized caller, which is 401). The secret is accepted from
 * `x-cron-secret` (preferred, matches ADR-0005 withApiAuth) or a legacy
 * `Authorization: Bearer <secret>` header.
 */
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.CRON_SECRET
    if (!expected) {
      // Misconfiguration — never silently accept, and do NOT report as 401.
      return jsonError(500, 'CRON_SECRET is not configured', { code: 'CRON_SECRET_MISSING' })
    }

    const provided =
      request.headers.get('x-cron-secret') ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      null

    if (!provided || provided !== expected) {
      return jsonError(401, 'Unauthorized', { code: 'UNAUTHENTICATED' })
    }

    // Optional single-schedule target.
    let scheduleId: string | undefined
    try {
      const body = await request.json()
      if (body && typeof body.scheduleId === 'string') {
        scheduleId = body.scheduleId
      }
    } catch {
      // No body / not JSON — fall through to the "all currently-due" path.
    }

    let targets: Array<{ id: string; name: string }>

    if (scheduleId) {
      const schedule = await prisma.clientReportSchedule.findUnique({
        where: { id: scheduleId },
        select: { id: true, name: true },
      })
      if (!schedule) {
        return jsonError(404, 'Schedule not found', { code: 'NOT_FOUND' })
      }
      targets = [schedule]
    } else {
      targets = await prisma.clientReportSchedule.findMany({
        where: { isActive: true, nextRun: { lte: new Date() } },
        select: { id: true, name: true },
      })
    }

    const results: Array<{
      scheduleId: string
      scheduleName: string
      jobId?: string
      status: 'enqueued' | 'failed'
      error?: string
    }> = []

    for (const target of targets) {
      try {
        const jobId = await enqueueClientReportRun(target.id)
        results.push({ scheduleId: target.id, scheduleName: target.name, jobId, status: 'enqueued' })
      } catch (error) {
        console.error(`Failed to enqueue report run for schedule ${target.id}:`, error)
        results.push({
          scheduleId: target.id,
          scheduleName: target.name,
          status: 'failed',
          error: (error as Error).message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      enqueued: results.filter((r) => r.status === 'enqueued').length,
      processed: results.length,
      results,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
