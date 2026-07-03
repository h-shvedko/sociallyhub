import { Job } from 'bullmq'
import nodemailer from 'nodemailer'

import { prisma } from '@/lib/prisma'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'

import { JobProcessor, JobResult } from '../queue-manager'
import { CLIENT_REPORT_JOB_NAME } from '../client-reports-queue'

// ============================================================================
// ADR-0008 Phase 4 — client-report generation processor.
//
// Replaces the old `/api/client-reports/schedules/run` inline generator, which
// fabricated report data with `Math.random()`. This processor:
//   1. Loads the ClientReportSchedule (+ client, template, workspace) by id.
//   2. Aggregates REAL `AnalyticsMetric` rows scoped to the client (its social
//      accounts + posts) over a date window derived from the schedule frequency.
//   3. Persists a `ClientReport` (status COMPLETED) exactly as the run endpoint
//      did — minus the mock metrics — and updates the schedule's lastRun/nextRun.
//   4. Best-effort emails the report to the schedule recipients.
//
// HONESTY: metrics come straight from the DB. If a client has few/no seeded
// `AnalyticsMetric` rows the report is genuinely sparse (`sparse: true`, zeros)
// rather than invented — real-but-sparse beats mock. Real file rendering
// (PDF/Excel) is ADR-0020's job; `data` holds the aggregated JSON and `fileSize`
// reflects that payload's real serialized size (no random figure, no fake path).
// ============================================================================

const ENGAGEMENT_METRIC_TYPES = ['likes', 'comments', 'shares'] as const

/** Lookback window (ms) per frequency — the span the report summarizes. */
const WINDOW_MS: Record<string, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
  QUARTERLY: 90 * 24 * 60 * 60 * 1000,
}

export interface ClientReportJobData {
  id: string
  type: typeof CLIENT_REPORT_JOB_NAME
  payload: { scheduleId: string }
  userId?: string
  workspaceId?: string
}

interface AggregatedReport {
  dateRange: { start: string; end: string }
  dataPoints: number
  sparse: boolean
  growthRate: number | null
  metrics: Record<string, number>
  byMetricType: Record<string, { total: number; count: number }>
  byPlatform: Record<string, number>
}

/**
 * Aggregate real AnalyticsMetric data for a client over the report window.
 *
 * A client's metrics are the union of metrics attributed to its social accounts
 * (`socialAccountId`) and its posts (`postId`). When the client has neither (or
 * no metrics land in the window) the result is an honest empty/sparse report.
 */
async function aggregateClientMetrics(
  clientId: string,
  workspaceId: string,
  frequency: string
): Promise<AggregatedReport> {
  const end = new Date()
  const windowMs = WINDOW_MS[frequency] ?? WINDOW_MS.MONTHLY
  const start = new Date(end.getTime() - windowMs)
  const prevStart = new Date(start.getTime() - windowMs)

  // Resolve the client's owned metric sources.
  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({ where: { clientId, workspaceId }, select: { id: true } }),
    prisma.post.findMany({ where: { clientId, workspaceId }, select: { id: true } }),
  ])
  const accountIds = accounts.map((a) => a.id)
  const postIds = posts.map((p) => p.id)

  const emptyReport = (): AggregatedReport => ({
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    dataPoints: 0,
    sparse: true,
    growthRate: null,
    metrics: {
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement: 0,
      clicks: 0,
      conversions: 0,
      followers: 0,
      pageViews: 0,
    },
    byMetricType: {},
    byPlatform: {},
  })

  // No accounts and no posts ⇒ nothing is attributable to this client.
  if (accountIds.length === 0 && postIds.length === 0) {
    return emptyReport()
  }

  const sourceFilter = [
    accountIds.length ? { socialAccountId: { in: accountIds } } : null,
    postIds.length ? { postId: { in: postIds } } : null,
  ].filter(Boolean) as Array<Record<string, unknown>>

  const [byType, byPlatformRows, prevEngagementAgg] = await Promise.all([
    prisma.analyticsMetric.groupBy({
      by: ['metricType'],
      where: { date: { gte: start, lte: end }, OR: sourceFilter },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.analyticsMetric.groupBy({
      by: ['platform'],
      where: { date: { gte: start, lte: end }, OR: sourceFilter },
      _sum: { value: true },
    }),
    prisma.analyticsMetric.aggregate({
      where: {
        date: { gte: prevStart, lt: start },
        metricType: { in: [...ENGAGEMENT_METRIC_TYPES] },
        OR: sourceFilter,
      },
      _sum: { value: true },
    }),
  ])

  const byMetricType: Record<string, { total: number; count: number }> = {}
  let dataPoints = 0
  for (const row of byType) {
    const total = row._sum.value ?? 0
    const count = row._count._all
    byMetricType[row.metricType] = { total, count }
    dataPoints += count
  }

  const byPlatform: Record<string, number> = {}
  for (const row of byPlatformRows) {
    const key = row.platform ?? 'unknown'
    byPlatform[key] = row._sum.value ?? 0
  }

  const sum = (type: string): number => byMetricType[type]?.total ?? 0
  const first = (...types: string[]): number => {
    for (const t of types) {
      if (byMetricType[t]) return byMetricType[t].total
    }
    return 0
  }

  const likes = sum('likes')
  const comments = sum('comments')
  const shares = sum('shares')
  const engagement = likes + comments + shares

  const prevEngagement = prevEngagementAgg._sum.value ?? 0
  const growthRate =
    prevEngagement > 0
      ? Math.round(((engagement - prevEngagement) / prevEngagement) * 1000) / 10
      : null

  return {
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    dataPoints,
    sparse: dataPoints === 0,
    growthRate,
    metrics: {
      impressions: sum('impressions'),
      reach: sum('reach'),
      likes,
      comments,
      shares,
      engagement,
      clicks: first('clicks', 'link_clicks'),
      conversions: first('conversion', 'conversions'),
      followers: first('followers', 'follower_count'),
      pageViews: sum('page_view'),
    },
    byMetricType,
    byPlatform,
  }
}

/**
 * Frequency-based next-run computation, kept local to the processor so consumers
 * that read the raw `ClientReportSchedule.nextRun` (e.g. the manual-run
 * catch-up query) see a forward-moving value. The GET route recomputes nextRun
 * for display; this keeps the stored column consistent.
 */
function computeNextRun(schedule: {
  frequency: string
  time: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  isActive: boolean
}): Date | null {
  if (!schedule.isActive) return null

  const now = new Date()
  const [hours, minutes] = schedule.time.split(':').map(Number)
  const nextRun = new Date()
  nextRun.setHours(hours, minutes, 0, 0)

  switch (schedule.frequency) {
    case 'DAILY':
      if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1)
      break
    case 'WEEKLY': {
      const dow = schedule.dayOfWeek ?? 0
      let delta = dow - nextRun.getDay()
      if (delta < 0 || (delta === 0 && nextRun <= now)) delta += 7
      nextRun.setDate(nextRun.getDate() + delta)
      break
    }
    case 'MONTHLY': {
      const dom = schedule.dayOfMonth ?? 1
      nextRun.setDate(dom)
      if (nextRun <= now || nextRun.getDate() !== dom) {
        nextRun.setMonth(nextRun.getMonth() + 1, dom)
      }
      break
    }
    case 'QUARTERLY': {
      const dom = schedule.dayOfMonth ?? 1
      nextRun.setDate(dom)
      while (nextRun <= now || nextRun.getDate() !== dom) {
        nextRun.setMonth(nextRun.getMonth() + 3, dom)
      }
      break
    }
    default:
      nextRun.setDate(nextRun.getDate() + 1)
  }

  return nextRun
}

/**
 * BullMQ processor for `generate_client_report`. Registered by JobScheduler on
 * the `client-reports` queue; fired by the per-schedule repeatable and by the
 * manual one-off from `/api/client-reports/schedules/run`.
 */
export const clientReportsProcessor: JobProcessor<ClientReportJobData> = async (
  job: Job<ClientReportJobData>
): Promise<JobResult> => {
  const timer = PerformanceLogger.startTimer('client_report_job')
  const scheduleId = job.data?.payload?.scheduleId

  const baseMetrics = () => ({
    duration: timer.getDuration(),
    memoryUsage: process.memoryUsage().heapUsed,
    timestamp: new Date().toISOString(),
  })

  if (!scheduleId) {
    // Malformed job — not retryable. Fail so it is visible, never fabricate.
    return { success: false, error: 'Missing scheduleId in job payload', metrics: baseMetrics() }
  }

  try {
    const schedule = await prisma.clientReportSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        client: { select: { id: true, name: true, email: true, company: true } },
        template: { select: { id: true, name: true, type: true, format: true, metrics: true } },
        workspace: { select: { id: true, name: true } },
      },
    })

    // Drift: the row was deleted but a repeatable still fired (or a stale one-off).
    // This is a normal, non-retryable no-op — the boot resync / removeJobScheduler
    // clears the scheduler. Return success so BullMQ does not burn retries.
    if (!schedule) {
      BusinessLogger.logSystemEvent('client_report_schedule_missing', { scheduleId })
      return {
        success: true,
        result: { scheduleId, skipped: true, reason: 'schedule_not_found' },
        metrics: baseMetrics(),
      }
    }

    const aggregate = await aggregateClientMetrics(
      schedule.clientId,
      schedule.workspaceId,
      schedule.frequency
    )

    const reportName = `${schedule.template.name} - ${schedule.client.name} - ${new Date().toLocaleDateString(
      'en-US',
      { month: 'long', year: 'numeric' }
    )}`

    const reportData = {
      generated: true,
      scheduledBy: schedule.id,
      dateRange: aggregate.dateRange,
      dataPoints: aggregate.dataPoints,
      sparse: aggregate.sparse,
      growthRate: aggregate.growthRate,
      metrics: aggregate.metrics,
      byMetricType: aggregate.byMetricType,
      byPlatform: aggregate.byPlatform,
    }

    // Honest file size: the real serialized size of the aggregated payload
    // (there is no rendered file yet — ADR-0020 owns PDF/Excel rendering).
    const fileSizeKb = Math.max(1, Math.round(Buffer.byteLength(JSON.stringify(reportData), 'utf8') / 1024))

    const now = new Date()

    const report = await prisma.clientReport.create({
      data: {
        workspaceId: schedule.workspaceId,
        clientId: schedule.clientId,
        templateId: schedule.templateId,
        name: reportName,
        description: `Automatically generated report from schedule: ${schedule.name}`,
        type: schedule.template.type,
        format: schedule.template.format[0] || 'PDF',
        frequency: schedule.frequency,
        status: 'COMPLETED',
        config: {
          source: 'schedule',
          scheduleId: schedule.id,
          metrics: schedule.template.metrics,
          dateRange: aggregate.dateRange,
        },
        data: reportData,
        fileSize: `${fileSizeKb}KB`,
        recipients: schedule.recipients,
        lastGenerated: now,
        downloadCount: 0,
      },
      include: {
        client: { select: { id: true, name: true, email: true, company: true } },
        template: { select: { id: true, name: true, type: true } },
      },
    })

    // Advance the schedule bookkeeping (lastRun always; nextRun kept forward).
    await prisma.clientReportSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRun: now,
        nextRun: computeNextRun(schedule),
      },
    })

    // Best-effort delivery: an email failure must not fail the (successful)
    // generation — the report is already persisted.
    let emailedTo = 0
    if (schedule.recipients && schedule.recipients.length > 0) {
      try {
        emailedTo = await sendScheduledReportEmail(report, schedule)
      } catch (err) {
        ErrorLogger.logExternalServiceError('smtp', err as Error, {
          operation: 'client_report_email',
          reportId: report.id,
          scheduleId: schedule.id,
        })
      }
    }

    timer.end({ success: true, scheduleId, reportId: report.id, dataPoints: aggregate.dataPoints })
    BusinessLogger.logSystemEvent('client_report_generated', {
      scheduleId: schedule.id,
      reportId: report.id,
      clientId: schedule.clientId,
      workspaceId: schedule.workspaceId,
      dataPoints: aggregate.dataPoints,
      sparse: aggregate.sparse,
      emailedTo,
      duration: timer.getDuration(),
    })

    return {
      success: true,
      result: {
        scheduleId: schedule.id,
        reportId: report.id,
        dataPoints: aggregate.dataPoints,
        sparse: aggregate.sparse,
        emailedTo,
      },
      metrics: baseMetrics(),
    }
  } catch (error) {
    // Infrastructure-transient (DB unreachable, etc.) — let BullMQ retry.
    timer.end({ success: false, error: true, scheduleId })
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'client_report_job',
      scheduleId,
    })
    return { success: false, error: (error as Error).message, metrics: baseMetrics() }
  }
}

// ----------------------------------------------------------------------------
// Email delivery (ported from the old run endpoint; `createTransport` typo
// fixed — the original called the non-existent `createTransporter`).
// ----------------------------------------------------------------------------

/** Minimal structural views of the persisted report / schedule the email needs. */
interface ReportEmailView {
  id: string
  name: string
  format: string
  client: { name: string }
}
interface ScheduleEmailView {
  name: string
  frequency: string
  recipients: string[]
}

async function sendScheduledReportEmail(
  report: ReportEmailView,
  schedule: ScheduleEmailView
): Promise<number> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })

  const reportUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3099'}/dashboard/clients?tab=reports&report=${report.id}`
  const emailSubject = `Scheduled Report: ${report.name}`
  const emailContent = generateScheduledReportEmailTemplate(report, schedule, reportUrl)

  const emailResults = await Promise.all(
    (schedule.recipients as string[]).map(async (email: string) => {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'SociallyHub Scheduler <scheduler@sociallyhub.com>',
          to: email.trim(),
          subject: emailSubject,
          html: emailContent,
        })
        return true
      } catch (err) {
        ErrorLogger.logExternalServiceError('smtp', err as Error, {
          operation: 'client_report_email_recipient',
          reportId: report.id,
          recipient: email,
        })
        return false
      }
    })
  )

  return emailResults.filter(Boolean).length
}

function generateScheduledReportEmailTemplate(
  report: ReportEmailView,
  schedule: ScheduleEmailView,
  reportUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scheduled Report - ${report.name}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background: linear-gradient(180deg, #f0f4f8 0%, #e2e8f0 100%); }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .schedule-badge { background: rgba(255, 255, 255, 0.2); border-radius: 20px; padding: 8px 16px; font-size: 14px; margin-top: 8px; display: inline-block; }
        .content { padding: 32px 24px; }
        .report-details { background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%); border-radius: 8px; padding: 24px; margin: 24px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: 600; color: #4b5563; }
        .detail-value { color: #1f2937; }
        .cta-section { text-align: center; margin: 32px 0; padding: 24px; background: linear-gradient(135deg, #f6f9fc 0%, #f0f4f8 100%); border-radius: 8px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.4); }
        .footer { background: #f9fafb; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        .automated-notice { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin: 16px 0; color: #92400e; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Scheduled Report</h1>
            <div class="schedule-badge">${String(schedule.frequency).toLowerCase()} • ${schedule.name}</div>
        </div>
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 24px;">Your scheduled report has been automatically generated and is ready for review.</p>
            <div class="automated-notice">🤖 This is an automated report delivery from your scheduled report: <strong>${schedule.name}</strong></div>
            <div class="report-details">
                <h3 style="margin: 0 0 16px 0; color: #1f2937;">Report Details</h3>
                <div class="detail-row"><span class="detail-label">Report Name</span><span class="detail-value">${report.name}</span></div>
                <div class="detail-row"><span class="detail-label">Client</span><span class="detail-value">${report.client.name}</span></div>
                <div class="detail-row"><span class="detail-label">Schedule</span><span class="detail-value">${schedule.name} (${schedule.frequency})</span></div>
                <div class="detail-row"><span class="detail-label">Generated</span><span class="detail-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                <div class="detail-row"><span class="detail-label">Format</span><span class="detail-value">${report.format}</span></div>
            </div>
            <div class="cta-section">
                <h3 style="margin: 0 0 12px 0;">Access Your Report</h3>
                <p style="margin: 0 0 16px 0; color: #6b7280;">Click below to view and download your report</p>
                <a href="${reportUrl}" class="btn">View Report Dashboard</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">To modify or disable this scheduled report, please visit your SociallyHub dashboard and navigate to the Client Reports &gt; Scheduled tab.</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} SociallyHub. All rights reserved.<br>This email was sent from our automated reporting system.<br><a href="mailto:support@sociallyhub.com" style="color: #667eea;">Contact Support</a></p>
        </div>
    </div>
</body>
</html>
  `.trim()
}
