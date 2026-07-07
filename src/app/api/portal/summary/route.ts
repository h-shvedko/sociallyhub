import { NextResponse } from 'next/server'
import { requireClientViewer, ApiError } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { aggregateClientMetrics } from '@/lib/reports/aggregate-client-metrics'
import type { ReportBrandingProps } from '@/components/reports/report-snapshot-view'

// GET /api/portal/summary (ADR-0020 Phase 2, CLIENT_VIEWER only).
//
// The ONLY analytics surface a portal viewer gets: a curated, server-derived
// metric snapshot for THEIR client (same aggregation the report worker uses).
// The portal never touches /api/analytics/* — this endpoint is the allowlist.

const CLIENT_VISIBLE_STATUSES = ['COMPLETED', 'SENT']

export async function GET() {
  try {
    // No workspaceId argument: resolve the caller's CLIENT_VIEWER membership
    // (401 unauthenticated / 403 for any non-portal caller).
    const { membership, clientId } = await requireClientViewer()
    const workspaceId = membership.workspaceId

    const [client, workspace, brandingRow, summary, reportsTotal, lastReport] =
      await Promise.all([
        prisma.client.findFirst({
          where: { id: clientId, workspaceId },
          select: { id: true, name: true, company: true },
        }),
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        }),
        prisma.clientBranding.findUnique({
          where: { workspaceId },
          select: {
            title: true,
            logoUrl: true,
            primaryColor: true,
            accentColor: true,
            hideCredits: true,
          },
        }),
        aggregateClientMetrics(clientId, workspaceId, 'MONTHLY'),
        prisma.clientReport.count({
          where: { workspaceId, clientId, status: { in: CLIENT_VISIBLE_STATUSES } },
        }),
        prisma.clientReport.aggregate({
          where: { workspaceId, clientId, status: { in: CLIENT_VISIBLE_STATUSES } },
          _max: { lastGenerated: true },
        }),
      ])

    if (!client || !workspace) {
      // Membership points at a client/workspace that no longer exists
      // (deletion race) — the portal has nothing to show.
      throw new ApiError(404, 'Not found', 'NOT_FOUND')
    }

    const branding: ReportBrandingProps | null = brandingRow
      ? {
          title: brandingRow.title,
          logoUrl: brandingRow.logoUrl,
          primaryColor: brandingRow.primaryColor,
          accentColor: brandingRow.accentColor,
          hideCredits: brandingRow.hideCredits,
        }
      : null

    return NextResponse.json({
      client: { id: client.id, name: client.name, company: client.company },
      workspace: { name: workspace.name },
      branding,
      summary,
      reports: {
        total: reportsTotal,
        lastGeneratedAt: lastReport._max.lastGenerated,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
