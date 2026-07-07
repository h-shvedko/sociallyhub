// ADR-0020 Phase 1: revoke a report share link.
//
// DELETE — set revokedAt (idempotent). Revoked links become unusable on the
// public surface immediately (resolveUsableShareLink returns null → uniform
// 404, indistinguishable from unknown/expired).
//
// Guard chain (pinned): requireSession → load report by id (404) →
// requireWorkspaceRole(report.workspaceId, ['OWNER','ADMIN','PUBLISHER']) →
// verify the link belongs to that report AND that workspace.

import { NextRequest, NextResponse } from 'next/server'

import type { WorkspaceRole } from '@prisma/client'

import { requireSession, requireWorkspaceRole, ApiError } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

const MANAGER_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'PUBLISHER']

// DELETE /api/client-reports/[id]/share-links/[linkId] - Revoke a share link
// 200: { success: true } (idempotent — re-revoking keeps the original revokedAt)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const { id: reportId, linkId } = await params

    await requireSession()

    const report = await prisma.clientReport.findUnique({
      where: { id: reportId },
    })
    if (!report) {
      throw new ApiError(404, 'Report not found', 'NOT_FOUND')
    }

    await requireWorkspaceRole(report.workspaceId, MANAGER_ROLES)

    const link = await prisma.reportShareLink.findUnique({
      where: { id: linkId },
    })
    // The link must belong to BOTH the report in the URL and the caller's
    // (report-derived) workspace — anything else is a uniform 404.
    if (
      !link ||
      link.reportId !== report.id ||
      link.workspaceId !== report.workspaceId
    ) {
      throw new ApiError(404, 'Share link not found', 'NOT_FOUND')
    }

    if (!link.revokedAt) {
      await prisma.reportShareLink.update({
        where: { id: link.id },
        data: { revokedAt: new Date() },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
