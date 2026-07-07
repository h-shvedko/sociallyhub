import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole, ApiError } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Access is REPORT-DERIVED (ADR-0020 Phase 2): load the report first, then
// gate on membership in ITS workspace — never on the caller's "first
// workspace" (the ADR-0004 multi-workspace bug this file used to have).

const CLIENT_VISIBLE_STATUSES = ['COMPLETED', 'SENT']

// DELETE /api/client-reports/[id] - Delete client report
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id: reportId } = await params

    // Check if report exists
    const report = await prisma.clientReport.findUnique({
      where: { id: reportId },
      include: {
        client: true
      }
    })

    if (!report) {
      return jsonError(404, 'Report not found')
    }

    // Membership in the report's workspace, agency roles only
    await requireWorkspaceRole(report.workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])

    // Delete the report
    await prisma.clientReport.delete({
      where: {
        id: reportId,
      }
    })

    console.log(`📊 Deleted client report ${reportId} for client ${report.client.name}`)

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/client-reports/[id] - Get specific client report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id: reportId } = await params

    // Get the report with full details
    const report = await prisma.clientReport.findUnique({
      where: { id: reportId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    if (!report) {
      return jsonError(404, 'Report not found')
    }

    // Membership in the report's workspace; CLIENT_VIEWER allowed but scoped.
    const membership = await requireWorkspaceRole(report.workspaceId, [
      'OWNER',
      'ADMIN',
      'PUBLISHER',
      'CLIENT_VIEWER',
    ])

    if (membership.role === 'CLIENT_VIEWER') {
      // A portal viewer only sees their own client's DELIVERED reports.
      // 404 (not 403) so out-of-scope report ids are indistinguishable from
      // nonexistent ones — no existence leak (ADR-0005 semantics).
      if (
        !membership.clientId ||
        membership.clientId !== report.clientId ||
        !CLIENT_VISIBLE_STATUSES.includes(report.status)
      ) {
        throw new ApiError(404, 'Not found', 'NOT_FOUND')
      }
    }

    return NextResponse.json({ report })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/client-reports/[id] - Update client report
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession()
    const { id: reportId } = await params
    const body = await request.json()

    // Check if report exists
    const existingReport = await prisma.clientReport.findUnique({
      where: { id: reportId }
    })

    if (!existingReport) {
      return jsonError(404, 'Report not found')
    }

    // Membership in the report's workspace, agency roles only
    await requireWorkspaceRole(existingReport.workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])

    // Verify client belongs to the report's workspace
    const client = await prisma.client.findFirst({
      where: {
        id: body.clientId,
        workspaceId: existingReport.workspaceId,
      }
    })

    if (!client) {
      return jsonError(404, 'Client not found')
    }

    // Update report
    const report = await prisma.clientReport.update({
      where: {
        id: reportId,
      },
      data: {
        clientId: body.clientId,
        templateId: body.templateId || null,
        name: body.name,
        description: body.description || null,
        type: body.type || 'CUSTOM',
        format: body.format || 'PDF',
        frequency: body.frequency || 'ON_DEMAND',
        config: body.config || null,
        recipients: body.recipients || []
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    console.log(`📊 Updated client report ${report.id} for client ${client.name}`)

    return NextResponse.json({ success: true, report })
  } catch (error) {
    return handleApiError(error)
  }
}
