// ADR-0020 Phase 1: share-link management for client reports.
//
// POST — create a share link for a report (raw token returned ONCE).
// GET  — list a report's share links (never tokenHash/passwordHash).
//
// Guard chain (pinned): requireSession → load report by id (404) →
// requireWorkspaceRole(report.workspaceId, ['OWNER','ADMIN','PUBLISHER']).
// The workspace is ALWAYS derived from the report row itself — never from
// "the user's first workspace" (the findFirst-any-workspace bug pattern).

import { NextRequest, NextResponse } from 'next/server'

import type { ClientReport, WorkspaceRole } from '@prisma/client'

import { requireSession, requireWorkspaceRole, ApiError, type AuthUser } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import {
  generateShareToken,
  hashSharePassword,
  shareLinkExpiry,
  buildShareUrl,
  isShareLinkUsable,
} from '@/lib/sharing/report-share'

const MANAGER_ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'PUBLISHER']

/** Statuses whose `data` snapshot may be exposed through a share link. */
const SHAREABLE_STATUSES = ['COMPLETED', 'SENT']

/**
 * Shared guard chain: session → report (404) → workspace role derived from
 * the report row. Throws ApiError; returns the caller + the report.
 */
async function requireManagedReport(
  reportId: string
): Promise<{ user: AuthUser; report: ClientReport }> {
  const user = await requireSession()
  const report = await prisma.clientReport.findUnique({
    where: { id: reportId },
  })
  if (!report) {
    throw new ApiError(404, 'Report not found', 'NOT_FOUND')
  }
  await requireWorkspaceRole(report.workspaceId, MANAGER_ROLES)
  return { user, report }
}

// POST /api/client-reports/[id]/share-links - Create a share link
// Body: { password?: string, expiresInDays?: number | null }
// 201: { shareLink: { id, createdAt, expiresAt, hasPassword, viewCount }, token, url }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params
    const { user, report } = await requireManagedReport(reportId)

    // Only completed snapshots are shareable: the public page renders
    // exclusively from ClientReport.data (snapshot-only, ADR-0020).
    if (!SHAREABLE_STATUSES.includes(report.status) || report.data === null) {
      return jsonError(409, 'Report has no shareable snapshot', {
        code: 'REPORT_NOT_SHAREABLE',
      })
    }

    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      // No/empty body is fine — all fields are optional.
      body = {}
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return jsonError(400, 'Invalid request body')
    }
    const { password, expiresInDays } = body as {
      password?: unknown
      expiresInDays?: unknown
    }

    if (
      password !== undefined &&
      password !== null &&
      (typeof password !== 'string' || password.length === 0)
    ) {
      return jsonError(400, 'password must be a non-empty string')
    }

    if (
      expiresInDays !== undefined &&
      expiresInDays !== null &&
      (typeof expiresInDays !== 'number' ||
        !Number.isFinite(expiresInDays) ||
        expiresInDays <= 0)
    ) {
      return jsonError(400, 'expiresInDays must be a positive number or null')
    }

    const { token, tokenHash } = generateShareToken()
    const passwordHash =
      typeof password === 'string' && password.length > 0
        ? await hashSharePassword(password)
        : null

    const link = await prisma.reportShareLink.create({
      data: {
        workspaceId: report.workspaceId,
        reportId: report.id,
        tokenHash,
        passwordHash,
        expiresAt: shareLinkExpiry(expiresInDays as number | null | undefined),
        createdById: user.id,
      },
    })

    // The raw token is returned here ONCE and never stored or logged.
    return NextResponse.json(
      {
        shareLink: {
          id: link.id,
          createdAt: link.createdAt,
          expiresAt: link.expiresAt,
          hasPassword: link.passwordHash !== null,
          viewCount: link.viewCount,
        },
        token,
        url: buildShareUrl(token),
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/client-reports/[id]/share-links - List a report's share links
// 200: { shareLinks: [{ id, createdAt, expiresAt, revokedAt, viewCount,
//        lastAccessedAt, hasPassword, active }] }
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params
    const { report } = await requireManagedReport(reportId)

    const links = await prisma.reportShareLink.findMany({
      where: { reportId: report.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      shareLinks: links.map((link) => ({
        id: link.id,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        revokedAt: link.revokedAt,
        viewCount: link.viewCount,
        lastAccessedAt: link.lastAccessedAt,
        hasPassword: link.passwordHash !== null,
        active: isShareLinkUsable(link),
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
