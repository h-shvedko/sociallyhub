// Public shared-report page (ADR-0020 Phase 1 item 4, design decision 2).
//
// SECURITY INVARIANTS (do not weaken):
// - Anonymous by design: never imports the auth module ('@/lib/auth',
//   next-auth) — enforced by an eslint zone.
// - Uniform 404: only resolveUsableShareLink() decides usability; unknown,
//   malformed, expired, and revoked tokens are indistinguishable (notFound()).
// - Snapshot-only render: exclusively from ClientReport.data + ClientBranding.
//   No live analytics queries on the public path.
// - The raw token is never logged and never stored.

import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import {
  resolveUsableShareLink,
  shareAccessCookieName,
  verifyShareAccessCookieValue,
} from '@/lib/sharing/report-share'
import {
  ReportSnapshotView,
  type ReportBrandingProps,
  type ReportSnapshotData,
} from '@/components/reports/report-snapshot-view'

import { SharePasswordForm } from './password-form'

import type { ClientBranding } from '@prisma/client'

// Counters (viewCount/lastAccessedAt) and cookie checks must run per request.
export const dynamic = 'force-dynamic'

const SHAREABLE_STATUSES = new Set(['COMPLETED', 'SENT'])

function toBrandingProps(row: ClientBranding | null): ReportBrandingProps | null {
  if (!row) return null
  return {
    title: row.title,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    hideCredits: row.hideCredits,
  }
}

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // The ONE usability decision — null covers unknown/malformed/expired/revoked.
  const link = await resolveUsableShareLink(token)
  if (!link) notFound()

  // Password gate: render the form WITHOUT incrementing counters until the
  // short-lived HMAC access cookie proves a successful bcrypt verification.
  if (link.passwordHash) {
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get(shareAccessCookieName(link.tokenHash))?.value
    if (!verifyShareAccessCookieValue(cookieValue, link.id)) {
      return <SharePasswordForm token={token} />
    }
  }

  // Snapshot-only: the frozen ClientReport.data plus the client's name.
  const report = await prisma.clientReport.findUnique({
    where: { id: link.reportId },
    include: { client: { select: { name: true } } },
  })
  if (!report || !SHAREABLE_STATUSES.has(report.status) || report.data == null) {
    notFound()
  }

  const brandingRow = await prisma.clientBranding.findUnique({
    where: { workspaceId: link.workspaceId },
  })

  // Full render is the only path that counts as an access.
  await prisma.reportShareLink.update({
    where: { id: link.id },
    data: { viewCount: { increment: 1 }, lastAccessedAt: new Date() },
  })

  return (
    <ReportSnapshotView
      meta={{
        name: report.name,
        type: report.type,
        clientName: report.client.name,
        generatedAt: report.lastGenerated?.toISOString() ?? null,
        description: report.description,
        frequency: report.frequency,
      }}
      data={report.data as unknown as ReportSnapshotData}
      branding={toBrandingProps(brandingRow)}
    />
  )
}
